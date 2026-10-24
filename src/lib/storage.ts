import {
  defaultRecord,
  type LearningPatch,
  type LearningRecord,
  type NoteVersion,
} from "../types";

export const GUEST_SCOPE = "guest";
const DATABASE = "curiveojr-learning";
const FIELDS = [
  "position",
  "duration",
  "watchedSeconds",
  "playbackEnded",
  "resumeDismissed",
  "status",
  "understanding",
  "favorite",
  "watchLater",
  "review",
  "note",
  "lastViewedAt",
] as const;
export type LearningField = (typeof FIELDS)[number];
export interface LearningOperation {
  id: string;
  owner: string;
  videoId: string;
  deviceId: string;
  sequence: number;
  patch: LearningPatch;
  baseVersions: Record<string, string>;
  noteVersions: NoteVersion[];
  createdAt: number;
}
interface StoredRecord {
  key: string;
  scope: string;
  record: LearningRecord;
  cloudRevision?: number;
  remoteRecord?: LearningRecord;
}
export interface RemoteRecord {
  record: LearningRecord;
  revision: number;
}
let database: Promise<IDBDatabase> | undefined;
let channel: BroadcastChannel | undefined;
const localListeners = new Set<(scope: string) => void>();

function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("このブラウザでは端末への保存が利用できません。"));
        return;
      }
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("records", { keyPath: "key" }).createIndex(
          "scope",
          "scope",
        );
        db.createObjectStore("pending", { keyPath: "id" }).createIndex(
          "owner",
          "owner",
        );
        db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        reject(request.error ?? new Error("端末への保存を開始できません。"));
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error("他のタブを閉じて保存を再試行してください。"));
      };
    });
  return database;
}
function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function complete(transaction: IDBTransaction): Promise<void> {
  const promise = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("端末への保存に失敗しました。"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("端末への保存に失敗しました。"));
  });
  void promise.catch(() => {});
  return promise;
}
function key(scope: string, id: string) {
  return `${scope}|${id}`;
}
function emit(scope: string) {
  localListeners.forEach((listener) => listener(scope));
  try {
    channel ??=
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(DATABASE)
        : undefined;
    channel?.postMessage(scope);
  } catch {
    /* IDB remains the source of truth. */
  }
}
export function subscribeStorage(
  listener: (scope: string) => void,
): () => void {
  localListeners.add(listener);
  try {
    channel ??=
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(DATABASE)
        : undefined;
    if (channel)
      channel.onmessage = (event) => {
        if (typeof event.data === "string")
          localListeners.forEach((item) => item(event.data));
      };
  } catch {
    /* Refresh on focus is also available. */
  }
  return () => {
    localListeners.delete(listener);
  };
}
export function unionNotes(...lists: NoteVersion[][]): NoteVersion[] {
  const unique = new Map<string, NoteVersion>();
  for (const note of lists.flat()) {
    const existing = unique.get(note.id);
    if (!existing) unique.set(note.id, note);
    else if (existing.text !== note.text) {
      let hash = 2166136261;
      for (let index = 0; index < note.text.length; index++)
        hash = Math.imul(hash ^ note.text.charCodeAt(index), 16777619);
      let conflictId = `${note.id}:conflict:${(hash >>> 0).toString(16)}`;
      while (
        unique.has(conflictId) &&
        unique.get(conflictId)!.text !== note.text
      )
        conflictId += ":1";
      unique.set(conflictId, { ...note, id: conflictId });
    }
  }
  return [...unique.values()].sort(
    (a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id),
  );
}
function applyOperation(
  current: LearningRecord,
  operation: LearningOperation,
): LearningRecord {
  const versions = { ...current.versions };
  for (const field of FIELDS)
    if (field in operation.patch) versions[field] = operation.id;
  return {
    ...current,
    ...operation.patch,
    ...(operation.patch.watchedSeconds !== undefined
      ? { watchedSeconds: Math.max(current.watchedSeconds ?? 0, operation.patch.watchedSeconds) }
      : {}),
    noteVersions: unionNotes(current.noteVersions, operation.noteVersions),
    versions,
    deviceId: operation.deviceId,
    updatedAt: operation.createdAt,
  };
}
export async function readRecords(
  scope: string,
): Promise<Record<string, LearningRecord>> {
  const db = await openDatabase();
  const tx = db.transaction("records", "readonly");
  const done = complete(tx);
  const values = await requestValue<StoredRecord[]>(
    tx.objectStore("records").index("scope").getAll(scope),
  );
  await done;
  return Object.fromEntries(
    values.map((value) => [value.record.videoId, value.record]),
  );
}
export async function pendingOperations(
  scope: string,
): Promise<LearningOperation[]> {
  const db = await openDatabase();
  const tx = db.transaction("pending", "readonly");
  const done = complete(tx);
  const pending = await requestValue<LearningOperation[]>(
    tx.objectStore("pending").index("owner").getAll(scope),
  );
  await done;
  return pending.sort((a, b) => a.sequence - b.sequence);
}
export function validatePatch(patch: LearningPatch): LearningPatch {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new Error("学習記録の形式が正しくありません。");
  const output: LearningPatch = {};
  for (const field of FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (["position", "duration", "watchedSeconds", "lastViewedAt"].includes(field)) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > Number.MAX_SAFE_INTEGER
      )
        throw new Error("学習記録の数値が正しくありません。");
    } else if (field === "note") {
      if (typeof value !== "string" || value.length > 20000)
        throw new Error("メモは20,000文字以内で入力してください。");
    } else if (field === "status") {
      if (!["unstarted", "learning", "completed"].includes(String(value)))
        throw new Error("学習状態が正しくありません。");
    } else if (field === "understanding") {
      if (!["unset", "understood", "unsure", "review"].includes(String(value)))
        throw new Error("理解度が正しくありません。");
    } else if (typeof value !== "boolean")
      throw new Error("学習記録の値が正しくありません。");
    (output as Record<string, unknown>)[field] = value;
  }
  return output;
}
function validateVideoId(id: string) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new Error("動画IDが正しくありません。");
}
async function nextIdentity(
  tx: IDBTransaction,
): Promise<{ deviceId: string; sequence: number }> {
  const store = tx.objectStore("meta");
  const previous = await requestValue<
    { key: string; deviceId: string; sequence: number } | undefined
  >(store.get("identity"));
  const identity = {
    key: "identity",
    deviceId: previous?.deviceId ?? crypto.randomUUID(),
    sequence: (previous?.sequence ?? 0) + 1,
  };
  store.put(identity);
  return identity;
}
async function writeOperation(
  tx: IDBTransaction,
  scope: string,
  id: string,
  patch: LearningPatch,
  extraNotes: NoteVersion[] = [],
): Promise<LearningRecord> {
  const store = tx.objectStore("records");
  const existing = await requestValue<StoredRecord | undefined>(
    store.get(key(scope, id)),
  );
  const current = existing?.record ?? defaultRecord(id);
  const identity = await nextIdentity(tx);
  const createdAt = Date.now();
  const opId = `${identity.deviceId}:${identity.sequence}`;
  const noteVersions = unionNotes(
    extraNotes,
    "note" in patch
      ? [
          {
            id: opId,
            text: patch.note!,
            deviceId: identity.deviceId,
            updatedAt: createdAt,
          },
        ]
      : [],
  );
  const operation: LearningOperation = {
    ...identity,
    id: opId,
    owner: scope,
    videoId: id,
    patch,
    baseVersions: { ...current.versions },
    noteVersions,
    createdAt,
  };
  const record = applyOperation(current, operation);
  store.put({
    key: key(scope, id),
    scope,
    record,
    cloudRevision: existing?.cloudRevision ?? 0,
    remoteRecord: existing?.remoteRecord,
  });
  tx.objectStore("pending").put(operation);
  return record;
}
export async function saveRecord(
  scope: string,
  id: string,
  patch: LearningPatch,
): Promise<LearningRecord> {
  validateVideoId(id);
  const validated = validatePatch(patch);
  const db = await openDatabase();
  const tx = db.transaction(["records", "pending", "meta"], "readwrite");
  const done = complete(tx);
  try {
    const record = await writeOperation(tx, scope, id, validated);
    await done;
    emit(scope);
    return record;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already aborted. */
    }
    await done.catch(() => {});
    throw error;
  }
}
export async function acknowledgeOperations(
  scope: string,
  operationIds: string[],
  remote: RemoteRecord,
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(["records", "pending"], "readwrite");
  const done = complete(tx);
  const pendingStore = tx.objectStore("pending");
  for (const operationId of operationIds) {
    const operation = await requestValue<LearningOperation | undefined>(
      pendingStore.get(operationId),
    );
    if (operation?.owner === scope) pendingStore.delete(operationId);
  }
  const remaining = await requestValue<LearningOperation[]>(
    pendingStore.index("owner").getAll(scope),
  );
  const store = tx.objectStore("records");
  const old = await requestValue<StoredRecord | undefined>(
    store.get(key(scope, remote.record.videoId)),
  );
  const baseline =
    old && (old.cloudRevision ?? 0) > remote.revision
      ? (old.remoteRecord ?? old.record)
      : remote.record;
  let record = baseline;
  record = {
    ...record,
    noteVersions: unionNotes(
      old?.record.noteVersions ?? [],
      record.noteVersions,
    ),
  };
  for (const op of remaining
    .filter((op) => op.videoId === record.videoId)
    .sort((a, b) => a.sequence - b.sequence))
    record = applyOperation(record, op);
  store.put({
    key: key(scope, record.videoId),
    scope,
    record,
    remoteRecord: baseline,
    cloudRevision: Math.max(old?.cloudRevision ?? 0, remote.revision),
  });
  await done;
  emit(scope);
}
export async function receiveRemote(
  scope: string,
  remoteRecords: RemoteRecord[],
): Promise<void> {
  if (!remoteRecords.length) return;
  const db = await openDatabase();
  const tx = db.transaction(["records", "pending"], "readwrite");
  const done = complete(tx);
  const pending = await requestValue<LearningOperation[]>(
    tx.objectStore("pending").index("owner").getAll(scope),
  );
  const store = tx.objectStore("records");
  for (const remote of remoteRecords) {
    const old = await requestValue<StoredRecord | undefined>(
      store.get(key(scope, remote.record.videoId)),
    );
    if ((old?.cloudRevision ?? 0) > remote.revision) continue;
    let record = {
      ...remote.record,
      noteVersions: unionNotes(
        old?.record.noteVersions ?? [],
        remote.record.noteVersions,
      ),
    };
    for (const op of pending
      .filter((op) => op.videoId === remote.record.videoId)
      .sort((a, b) => a.sequence - b.sequence))
      record = applyOperation(record, op);
    store.put({
      key: key(scope, record.videoId),
      scope,
      record,
      remoteRecord: remote.record,
      cloudRevision: remote.revision,
    });
  }
  await done;
  emit(scope);
}
// Signing in transfers only the current guest workspace. User-specific queues never change owner.
export async function claimGuest(scope: string): Promise<void> {
  if (scope === GUEST_SCOPE) return;
  const db = await openDatabase();
  const tx = db.transaction(["records", "pending", "meta"], "readwrite");
  const done = complete(tx);
  const recordsStore = tx.objectStore("records");
  const pendingStore = tx.objectStore("pending");
  const guests = await requestValue<StoredRecord[]>(
    recordsStore.index("scope").getAll(GUEST_SCOPE),
  );
  const guestOps = await requestValue<LearningOperation[]>(
    pendingStore.index("owner").getAll(GUEST_SCOPE),
  );
  for (const guest of guests) {
    const existing = await requestValue<StoredRecord | undefined>(
      recordsStore.get(key(scope, guest.record.videoId)),
    );
    const patch: LearningPatch = {};
    for (const field of FIELDS)
      if (guest.record.versions[field] && !existing?.record.versions[field] && guest.record[field] !== undefined)
        (patch as Record<string, unknown>)[field] = guest.record[field];
    await writeOperation(
      tx,
      scope,
      guest.record.videoId,
      patch,
      guest.record.noteVersions,
    );
    recordsStore.delete(guest.key);
  }
  guestOps.forEach((op) => pendingStore.delete(op.id));
  await done;
  if (guests.length) {
    emit(scope);
    emit(GUEST_SCOPE);
  }
}
export function parseBackup(input: unknown): LearningRecord[] {
  if (!input || typeof input !== "object")
    throw new Error("Curiveoのバックアップではありません。");
  const data = input as {
    app?: unknown;
    schemaVersion?: unknown;
    records?: unknown;
  };
  if (
    data.app !== "Curiveo" ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.records) ||
    data.records.length > 10000
  )
    throw new Error("対応していないバックアップ形式です。");
  const ids = new Set<string>();
  return data.records.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("学習記録の形式が正しくありません。");
    const record = raw as Record<string, unknown>;
    const id = record.videoId;
    if (typeof id !== "string") throw new Error("動画IDが正しくありません。");
    validateVideoId(id);
    if (ids.has(id))
      throw new Error("バックアップに同じ動画が重複しています。");
    ids.add(id);
    const patch = validatePatch(record as LearningPatch);
    if (
      !FIELDS.filter((field) => field !== "watchedSeconds" && field !== "resumeDismissed")
        .every((field) => field in patch) ||
      !Array.isArray(record.noteVersions) ||
      record.noteVersions.length > 5000
    )
      throw new Error("学習記録に必要な項目がありません。");
    const notes: NoteVersion[] = record.noteVersions.map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new Error("メモ履歴が正しくありません。");
      const note = value as NoteVersion;
      if (
        typeof note.id !== "string" ||
        note.id.length > 500 ||
        typeof note.text !== "string" ||
        note.text.length > 20000 ||
        typeof note.deviceId !== "string" ||
        !Number.isFinite(note.updatedAt) ||
        note.updatedAt < 0
      )
        throw new Error("メモ履歴が正しくありません。");
      return {
        id: note.id,
        text: note.text,
        deviceId: note.deviceId,
        updatedAt: note.updatedAt,
      };
    });
    return {
      ...defaultRecord(id),
      ...patch,
      noteVersions: unionNotes(notes),
      updatedAt: Number.isFinite(record.updatedAt)
        ? Number(record.updatedAt)
        : 0,
    };
  });
}
export async function restoreRecords(
  scope: string,
  imports: LearningRecord[],
): Promise<number> {
  const db = await openDatabase();
  const tx = db.transaction(["records", "pending", "meta"], "readwrite");
  const done = complete(tx);
  try {
    for (const imported of imports) {
      const existing = await requestValue<StoredRecord | undefined>(
        tx.objectStore("records").get(key(scope, imported.videoId)),
      );
      const patch: LearningPatch = {};
      // Restore missing fields only; live edits survive, and every imported note remains available.
      for (const field of FIELDS)
        if (!existing?.record.versions[field] && imported[field] !== undefined)
          (patch as Record<string, unknown>)[field] = imported[field];
      await writeOperation(
        tx,
        scope,
        imported.videoId,
        patch,
        imported.noteVersions,
      );
    }
    await done;
    emit(scope);
    return imports.length;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already aborted. */
    }
    await done.catch(() => {});
    throw error;
  }
}
