import raw from "./data/catalog.json";
import type { Catalog, Video, LearningRecord, Series, SubjectId } from "./types";
export const catalog = raw as Catalog;
export const videoMap = new Map(catalog.videos.map((v) => [v.id, v]));
export const unitMap = new Map(catalog.units.map((u) => [u.id, u]));
export const seriesMap = new Map(catalog.series.map((s) => [s.id, s]));
export const channelMap = new Map(catalog.channels.map((c) => [c.id, c]));
export const subjectMap = new Map(catalog.subjects.map((s) => [s.id, s]));
export const videoSubjects=(video:Video)=>video.subjectIds||[video.subjectId];
export const inSubject=(video:Video,subjectId:string)=>videoSubjects(video).includes(subjectId as SubjectId);
export const seriesInSubject=(series:Series,subjectId:string)=>(series.subjectIds||[series.subjectId]).includes(subjectId as SubjectId);
export const routeMap=new Map((catalog.routes||[]).map(route=>[route.id,route]));
export function routeSequence(routeId:string){const route=routeMap.get(routeId);const seen=new Set<string>();return (route?.steps||[]).flatMap(step=>(step.videoIds||seriesMap.get(step.seriesId)?.videoIds||[]).flatMap(id=>{if(seen.has(id))return [];seen.add(id);return [{videoId:id,seriesId:step.seriesId}];}));}
export const roleLabels = {
  core: "基礎授業",
  reinforcement: "理解補強",
  exam: "問題演習",
  advanced: "発展講義",
};
export const statusLabels = {
  unstarted: "未学習",
  learning: "学習中",
  completed: "学習済み",
};
export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(
      /[ⅠⅡⅢⅣⅤ]/g,
      (s) => ({ Ⅰ: "i", Ⅱ: "ii", Ⅲ: "iii", Ⅳ: "iv", Ⅴ: "v" })[s] || s,
    )
    .replace(/\s+/g, " ")
    .trim();
}
const searchIndex = new Map(
  catalog.videos.map((v) => [
    v.id,
    normalize(
      [
        v.title,
        v.level,
        ...v.unitIds.map((id) => unitMap.get(id)?.name),
        ...videoSubjects(v).map(id=>subjectMap.get(id)?.name),
        v.topic,
        ...v.unitIds.flatMap(id=>unitMap.get(id)?.path||[]),
        channelMap.get(v.channelId)?.name,
        ...v.seriesIds.map((id) => seriesMap.get(id)?.title),
        roleLabels[v.role],
      ].join(" "),
    ),
  ]),
);
export function searchVideos(query: string, list = catalog.videos) {
  const terms = normalize(query).split(" ").filter(Boolean);
  return terms.length
    ? list.filter((v) => terms.every((t) => searchIndex.get(v.id)?.includes(t)))
    : list;
}
export function progress(
  list: Video[],
  records: Record<string, LearningRecord>,
) {
  const ids = [...new Set(list.map((v) => v.id))];
  const completed = ids.filter(
    (id) => records[id]?.status === "completed",
  ).length;
  return {
    total: ids.length,
    completed,
    percent: ids.length ? Math.round((100 * completed) / ids.length) : 0,
  };
}
export function time(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function videoHref(v:Video,seriesId?:string,routeId?:string,subjectId?:string,playlistScope?:string){const params=new URLSearchParams();if(seriesId)params.set("series",seriesId);if(routeId)params.set("route",routeId);if(subjectId&&subjectId!==v.subjectId)params.set("subject",subjectId);if(playlistScope)params.set("playlist",playlistScope);return `#/watch/${v.id}${params.size?`?${params}`:""}`;}
