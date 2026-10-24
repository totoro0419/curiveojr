import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  defaultRecord,
  type LearningPatch,
  type LearningRecord,
} from "../types";
import {
  claimGuest,
  GUEST_SCOPE,
  parseBackup,
  readRecords,
  restoreRecords,
  saveRecord,
  subscribeStorage,
} from "../lib/storage";
import {
  firebaseConfigured,
  firebaseServices,
  googleLogin,
  googleLogout,
  startLearningSync,
} from "../lib/sync";

import { registerUpdateGuard } from "../lib/pwa";

type Sync = ReturnType<typeof startLearningSync>;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "学習記録を保存できませんでした。";
export function useLearning() {
  const [records, setRecords] = useState<Record<string, LearningRecord>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("読み込み中…");
  const [syncState, setSyncState] = useState(
    firebaseConfigured
      ? "ログインすると端末間同期できます"
      : "ローカルモード・Firebase未設定",
  );
  const [user, setUser] = useState<{
    displayName: string | null;
    email: string | null;
  } | null>(null);
  const pendingWrites=useRef(new Set<Promise<unknown>>());
  useEffect(()=>registerUpdateGuard(async()=>{while(pendingWrites.current.size){const results=await Promise.allSettled([...pendingWrites.current]);const failed=results.find((result):result is PromiseRejectedResult=>result.status==="rejected");if(failed)throw failed.reason;}}),[]);
  const scope = useRef(GUEST_SCOPE);
  const sync = useRef<Sync | undefined>(undefined);
  const mounted = useRef(false);
  const session = useRef(0);
  const refreshCounter = useRef(0);
  const refresh = useCallback(async (owner = scope.current) => {
    const request = ++refreshCounter.current;
    const loaded = await readRecords(owner);
    if (
      mounted.current &&
      scope.current === owner &&
      request === refreshCounter.current
    )
      setRecords(loaded);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const unsubscribeStorage = subscribeStorage((owner) => {
      if (owner === scope.current)
        void refresh(owner).catch((problem) => {
          setError(message(problem));
          setSaveState("保存状態を確認できません");
        });
    });
    const focus = () =>
      void refresh().catch((problem) => setError(message(problem)));
    window.addEventListener("focus", focus);
    const activate = async (
      uid: string | null,
      displayName: string | null = null,
      email: string | null = null,
    ) => {
      const token = ++session.current;
      sync.current?.stop();
      sync.current = undefined;
      setReady(false);
      const owner = uid ?? GUEST_SCOPE;
      scope.current = owner;
      try {
        if (uid) await claimGuest(uid);
        if (!mounted.current || session.current !== token) return;
        await refresh(owner);
        if (!mounted.current || session.current !== token) return;
        setUser(uid ? { displayName, email } : null);
        setReady(true);
        setSaveState("端末に保存済み");
        setSyncState(
          uid
            ? "クラウド接続中…"
            : firebaseConfigured
              ? "ログインすると端末間同期できます"
              : "ローカルモード・Firebase未設定",
        );
        if (uid)
          sync.current = startLearningSync(uid, {
            state: (value) => {
              if (mounted.current && scope.current === uid) setSyncState(value);
            },
            error: (value) => {
              if (mounted.current && scope.current === uid) setError(value);
            },
          });
      } catch (problem) {
        if (mounted.current && session.current === token) {
          setReady(true);
          setError(message(problem));
          setSaveState("端末への保存を利用できません");
          setRecords({});
        }
      }
    };
    let unsubscribeAuth: (() => void) | undefined;
    try {
      const firebase = firebaseServices();
      unsubscribeAuth = firebase
        ? onAuthStateChanged(
            firebase.auth,
            (account) => {
              void activate(
                account?.uid ?? null,
                account?.displayName,
                account?.email,
              );
            },
            (problem) => {
              setError(message(problem));
              void activate(null);
            },
          )
        : undefined;
      if (!firebase) void activate(null);
    } catch (problem) {
      setError(message(problem));
      void activate(null);
    }
    return () => {
      mounted.current = false;
      ++session.current;
      unsubscribeStorage();
      unsubscribeAuth?.();
      sync.current?.stop();
      sync.current = undefined;
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const get = useCallback(
    (id: string) => records[id] ?? defaultRecord(id),
    [records],
  );
  const save = useCallback(
    async (id: string, patch: LearningPatch) => {
      const owner = scope.current;
      setSaveState("保存中…");
      try {
        const request=saveRecord(owner,id,patch);pendingWrites.current.add(request);
        try{await request;}finally{pendingWrites.current.delete(request);}
        if (owner === scope.current && mounted.current) {
          await refresh(owner);
          setSaveState("端末に保存済み");
          setError("");
          sync.current?.schedule();
        }
      } catch (problem) {
        if (mounted.current) {
          setSaveState("保存できません");
          setError(message(problem));
        }
        throw problem;
      }
    },
    [refresh],
  );
  const login = useCallback(async () => {
    try {
      setError("");
      await googleLogin();
    } catch (problem) {
      setError(message(problem));
      throw problem;
    }
  }, []);
  const logout = useCallback(async () => {
    try {
      sync.current?.stop();
      sync.current = undefined;
      await googleLogout();
    } catch (problem) {
      setError(message(problem));
      throw problem;
    }
  }, []);
  const retrySync = useCallback(async () => {
    setError("");
    if (sync.current) await sync.current.flush();
    else if (!firebaseConfigured)
      setSyncState("ローカルモード・Firebase未設定");
  }, []);
  const exportBackup = useCallback(async () => {
    try {
      const loaded = await readRecords(scope.current);
      const data = {
        app: "Curiveo",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        records: Object.values(loaded),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `curiveo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problem) {
      setError(message(problem));
      throw problem;
    }
  }, []);
  const importBackup = useCallback(
    async (file: File) => {
      const owner = scope.current;
      try {
        if (file.size > 20 * 1024 * 1024)
          throw new Error(
            "バックアップは20MB以内のJSONファイルを選択してください。",
          );
        const imports = parseBackup(JSON.parse(await file.text()));
        const request=restoreRecords(owner, imports);pendingWrites.current.add(request);
        let count:number;try{count=await request;}finally{pendingWrites.current.delete(request);}
        if (owner === scope.current) {
          await refresh(owner);
          setSaveState("端末に保存済み");
          setError("");
          sync.current?.schedule(true);
        }
        return { count };
      } catch (problem) {
        setError(message(problem));
        throw problem;
      }
    },
    [refresh],
  );
  return {
    records,
    ready,
    error,
    saveState,
    syncState,
    user,
    configured: firebaseConfigured,
    get,
    save,
    login,
    logout,
    retrySync,
    exportBackup,
    importBackup,
  };
}
