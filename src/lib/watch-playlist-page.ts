/** The playlist total and its rows must use exactly the same visible page. */
export const WATCH_PLAYLIST_PAGE_SIZE = 30;

export function watchPlaylistPage<T>(entries: readonly T[], requestedPage: number) {
  const lastPage = Math.max(0, Math.ceil(entries.length / WATCH_PLAYLIST_PAGE_SIZE) - 1);
  const page = Number.isFinite(requestedPage)
    ? Math.max(0, Math.min(Math.trunc(requestedPage), lastPage))
    : 0;
  const start = page * WATCH_PLAYLIST_PAGE_SIZE;
  const end = Math.min(start + WATCH_PLAYLIST_PAGE_SIZE, entries.length);
  return { page, start, end, entries: entries.slice(start, end) };
}
