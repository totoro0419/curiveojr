/** Stable order-sensitive identifier for a selected video list. */
export function listKey(ids: readonly string[]) {
  let hash = 2166136261;
  for (const id of ids) for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return `${ids.length}-${(hash >>> 0).toString(16)}`;
}
