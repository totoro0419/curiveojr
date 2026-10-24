import { catalog, routeMap, routeSequence, seriesMap, videoMap } from '../catalog';
import { courseOutline } from '../navigation/course-outline';
import { learningNodes } from '../navigation/hierarchy';
import { listKey } from './list-key';

const PREFIX = 'curiveo:watch-list:';
const dedup = (ids: readonly string[]) => [...new Set(ids)].filter(id => videoMap.has(id));

/** Persist only explicitly displayed ad-hoc lists (search/library), not entire course catalogs. */
export function saveWatchList(scope: string, ids: readonly string[], title = 'この一覧') {
  if (!scope.startsWith('saved:') || listKey(ids) !== scope.slice(6)) return;
  try {
    sessionStorage.setItem(PREFIX + scope, JSON.stringify({ ids, title }));
  } catch { /* Storage may be disabled; direct links still use a safe fallback. */ }
}

function savedList(scope: string): { ids: string[]; title: string } | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + scope);
    if (!raw) return;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return;
    const entry = value as { ids?: unknown; title?: unknown };
    if (!Array.isArray(entry.ids) || entry.ids.length > catalog.videos.length ||
        !entry.ids.every(id => typeof id === 'string')) return;
    if (listKey(entry.ids) !== scope.slice(6)) return;
    return { ids: dedup(entry.ids), title: typeof entry.title === 'string' ? entry.title : 'この一覧' };
  } catch { return; }
}

export interface WatchListSelection {
  ids: string[];
  title: string;
  scope?: string;
}

/** Resolve the list that actually launched playback, validating membership before honoring it. */
export function resolveWatchList(currentId: string, seriesId?: string, routeId?: string, scope?: string): WatchListSelection {
  const series = seriesMap.get(seriesId ?? '');
  const route = routeMap.get(routeId ?? '');
  const choose = (ids: readonly string[], title: string, selectedScope?: string): WatchListSelection | undefined => {
    const valid = dedup(ids);
    return valid.includes(currentId) ? { ids: valid, title, scope: selectedScope } : undefined;
  };

  if (scope && scope.length < 256) {
    if (scope.startsWith('outline:') && series) {
      const chapter = courseOutline(series).find(group => group.id === scope.slice(8));
      if (chapter) {
        const result = choose(chapter.videoIds, chapter.title, scope);
        if (result) return result;
      }
    } else if (scope.startsWith('node:')) {
      const node = learningNodes.get(scope.slice(5));
      if (node) {
        const inNode = new Set(node.videoIds);
        const ids = series ? series.videoIds.filter(id => inNode.has(id)) : node.videoIds;
        const result = choose(ids, node.title, scope);
        if (result) return result;
      }
    } else if (scope.startsWith('route-step:') && route) {
      const raw = scope.slice(11);
      const index = Number(raw);
      if (/^(0|[1-9]\d*)$/.test(raw) && Number.isSafeInteger(index) && index < route.steps.length) {
        const step = route.steps[index];
        const ids = step.videoIds ?? seriesMap.get(step.seriesId)?.videoIds ?? [];
        const result = choose(ids, step.label || seriesMap.get(step.seriesId)?.title || route.title, scope);
        if (result) return result;
      }
    } else if (scope.startsWith('saved:')) {
      const saved = savedList(scope);
      if (saved) {
        const result = choose(saved.ids, saved.title, scope);
        if (result) return result;
      }
    }
  }

  // Unscoped links remain backward compatible. Invalid or stale scopes never select an unrelated list.
  if (route) {
    const result = choose(routeSequence(route.id).map(step => step.videoId), 'この学習ルートの授業');
    if (result) return result;
  }
  if (series) {
    const result = choose(series.videoIds, 'この講座の授業');
    if (result) return result;
  }
  const video = videoMap.get(currentId);
  const related = video ? catalog.videos
    .filter(candidate => candidate.unitIds.some(id => video.unitIds.includes(id)))
    .sort((a, b) => a.order - b.order).map(candidate => candidate.id) : [];
  return choose(related, '関連する授業') ?? { ids: video ? [currentId] : [], title: 'この授業' };
}
