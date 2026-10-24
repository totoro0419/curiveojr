import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { defaultRecord, type LearningRecord } from "../types";
import {
  acknowledgeOperations,
  parseBackup,
  pendingOperations,
  receiveRemote,
  unionNotes,
  type LearningOperation,
} from "./storage";

const env =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env ??
  {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
};
export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
let services: { auth: Auth; db: Firestore } | undefined;
export function firebaseServices() {
  if (!firebaseConfigured) return undefined;
  if (!services) {
    const app =
      getApps().find((app) => app.name === "curiveojr") ??
      initializeApp(config, "curiveojr");
    services = { auth: getAuth(app), db: getFirestore(app) };
  }
  return services;
}
export async function googleLogin(): Promise<void> {
  const firebase = firebaseServices();
  if (!firebase)
    throw new Error(
      "Firebaseの設定がまだありません。端末内の学習記録は利用できます。",
    );
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(firebase.auth, provider);
}
export async function googleLogout(): Promise<void> {
  const firebase = firebaseServices();
  if (firebase) await signOut(firebase.auth);
}

interface CloudRecord {
  record: LearningRecord;
  revision: number;
  deviceSequences: Record<string, number>;
}
function decodeRecord(input: unknown): LearningRecord {
  const parsed = parseBackup({
    app: "Curiveo",
    schemaVersion: 1,
    records: [input],
  })[0];
  const raw = input as LearningRecord;
  const versions: Record<string, string> = {};
  if (raw.versions && typeof raw.versions === "object")
    for (const [key, value] of Object.entries(raw.versions))
      if (typeof value === "string" && value.length <= 200)
        versions[key] = value;
  return {
    ...parsed,
    versions,
    deviceId: typeof raw.deviceId === "string" ? raw.deviceId : "",
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
}
// Firestore retries this pure function against the latest revision. Device clocks are not conflict winners.
export function mergeCloudOperations(
  previous: CloudRecord | undefined,
  operations: LearningOperation[],
): CloudRecord {
  let record = previous?.record ?? defaultRecord(operations[0].videoId);
  const sequences = { ...(previous?.deviceSequences ?? {}) };
  let changed = false;
  for (const operation of [...operations].sort(
    (a, b) => a.sequence - b.sequence,
  )) {
    if ((sequences[operation.deviceId] ?? 0) >= operation.sequence) continue;
    const versions = { ...record.versions };
    for (const field of Object.keys(operation.patch))
      versions[field] = operation.id;
    record = {
      ...record,
      ...operation.patch,
      ...(operation.patch.watchedSeconds !== undefined
        ? { watchedSeconds: Math.max(record.watchedSeconds ?? 0, operation.patch.watchedSeconds) }
        : {}),
      versions,
      noteVersions: unionNotes(record.noteVersions, operation.noteVersions),
      deviceId: operation.deviceId,
      updatedAt: operation.createdAt,
      lastViewedAt: Math.max(
        record.lastViewedAt,
        operation.patch.lastViewedAt ?? 0,
      ),
    };
    sequences[operation.deviceId] = operation.sequence;
    changed = true;
  }
  return {
    record,
    deviceSequences: sequences,
    revision: (previous?.revision ?? 0) + (changed ? 1 : 0),
  };
}
export function startLearningSync(
  uid: string,
  callbacks: {
    state: (state: string) => void;
    error: (message: string) => void;
  },
) {
  const firebase = firebaseServices();
  if (!firebase) throw new Error("Firebase未設定です。");
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flight: Promise<void> | undefined;
  let serverSeen = false;
  const active = () => !stopped && firebase.auth.currentUser?.uid === uid;
  const pendingLabel = () =>
    navigator.onLine ? "端末に保存済み・同期待ち" : "オフライン・端末に保存";
  const flush = (): Promise<void> => {
    if (flight) return flight;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    flight = (async () => {
      if (!active()) return;
      if (!navigator.onLine) {
        callbacks.state(pendingLabel());
        return;
      }
      callbacks.state("同期中…");
      const pending = await pendingOperations(uid);
      const grouped = new Map<string, LearningOperation[]>();
      for (const op of pending)
        grouped.set(op.videoId, [...(grouped.get(op.videoId) ?? []), op]);
      for (const [videoId, operations] of grouped) {
        if (!active()) return;
        const reference = doc(firebase.db, "users", uid, "learning", videoId);
        const merged = await runTransaction(
          firebase.db,
          async (transaction) => {
            if (!active()) throw new Error("ログイン状態が変更されました。");
            const snapshot = await transaction.get(reference);
            const raw = snapshot.exists() ? snapshot.data() : undefined;
            const old: CloudRecord | undefined = raw
              ? {
                  record: decodeRecord(raw.record),
                  revision: Number(raw.revision) || 0,
                  deviceSequences: raw.deviceSequences ?? {},
                }
              : undefined;
            const next = mergeCloudOperations(old, operations);
            if (new Blob([JSON.stringify(next)]).size > 850000)
              throw new Error(
                "メモ履歴がクラウドの1件の上限に近づいています。端末内の記録とバックアップは維持されています。",
              );
            if (next.revision !== old?.revision)
              transaction.set(reference, {
                ...next,
                committedAt: serverTimestamp(),
              });
            return { record: next.record, revision: next.revision };
          },
        );
        if (!active()) return;
        // Acknowledging the batch replays remaining edits; saves made during upload cannot disappear.
        await acknowledgeOperations(
          uid,
          operations.map((op) => op.id),
          merged,
        );
      }
      if (!active()) return;
      const remains = await pendingOperations(uid);
      callbacks.state(
        remains.length
          ? pendingLabel()
          : serverSeen
            ? "同期済み"
            : "クラウド接続中…",
      );
      if (remains.length) schedule();
    })()
      .catch((error: unknown) => {
        if (active()) {
          callbacks.state(
            navigator.onLine ? "同期できません・端末に保存" : pendingLabel(),
          );
          callbacks.error(
            error instanceof Error ? error.message : "同期に失敗しました。",
          );
        }
      })
      .finally(() => {
        flight = undefined;
      });
    return flight;
  };
  const schedule = (immediate = false) => {
    if (!active()) return;
    callbacks.state(pendingLabel());
    if (immediate) {
      void flush();
      return;
    }
    // A fixed 30-second window avoids postponing sync forever during uninterrupted playback.
    if (!timer)
      timer = setTimeout(() => {
        timer = undefined;
        void flush();
      }, 30000);
  };
  const unsubscribe = onSnapshot(
    collection(firebase.db, "users", uid, "learning"),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!active()) return;
      serverSeen ||= !snapshot.metadata.fromCache;
      void (async () => {
        const records = snapshot
          .docChanges()
          .filter((change) => change.type !== "removed")
          .map((change) => ({
            record: decodeRecord(change.doc.data().record),
            revision: Number(change.doc.data().revision) || 0,
          }));
        await receiveRemote(uid, records);
        if (!active()) return;
        const pending = await pendingOperations(uid);
        if (pending.length) schedule(true);
        else
          callbacks.state(
            serverSeen && navigator.onLine
              ? "同期済み"
              : navigator.onLine
                ? "クラウド接続中…"
                : pendingLabel(),
          );
      })().catch((error) => {
        if (active()) {
          callbacks.state("同期できません・端末に保存");
          callbacks.error(
            error instanceof Error
              ? error.message
              : "クラウド記録を読み込めません。",
          );
        }
      });
    },
    (error) => {
      if (active()) {
        callbacks.state("同期できません・端末に保存");
        callbacks.error(error.message);
      }
    },
  );
  const online = () => schedule(true);
  const offline = () => callbacks.state(pendingLabel());
  const visibility = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  document.addEventListener("visibilitychange", visibility);
  callbacks.state(navigator.onLine ? "クラウド接続中…" : pendingLabel());
  return {
    schedule,
    flush,
    stop() {
      stopped = true;
      unsubscribe();
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
