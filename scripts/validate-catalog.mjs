import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("src/data/catalog.json", "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const ids = new Set(c.videos.map((v) => v.id));
assert(ids.size === c.videos.length, "Duplicate video IDs");
const channels = new Set(c.channels.map((x) => x.id)),
  subjects = new Set(c.subjects.map((x) => x.id)),
  units = new Set(c.units.map((x) => x.id)),
  series = new Set(c.series.map((x) => x.id));
assert(series.size === c.series.length, "Duplicate series");
assert(units.size === c.units.length, "Duplicate units");
for (const v of c.videos) {
  assert(/^[\w-]{11}$/.test(v.id), `Invalid video ID: ${v.id}`);
  assert(
    v.title && /^https:\/\//.test(v.sourceUrl),
    `Missing title/source: ${v.id}`,
  );
  assert(
    channels.has(v.channelId) && subjects.has(v.subjectId),
    `Missing subject/channel: ${v.id}`,
  );
  assert(
    v.unitIds.every((id) => units.has(id)) &&
      v.seriesIds.every((id) => series.has(id)),
    `Missing unit/series: ${v.id}`,
  );
  assert(
    ["verified", "needs-review"].includes(v.verification),
    `Invalid verification: ${v.id}`,
  );
  assert(
    ["current", "legacy", "mixed", "unverified"].includes(v.curriculum),
    `Invalid curriculum: ${v.id}`,
  );
  for (const p of v.chapters || [])
    assert(
      p.title && Number.isFinite(p.startSeconds) && p.startSeconds >= 0,
      `Invalid chapter: ${v.id}`,
    );
}
for (const s of c.series) {
  assert(
    s.videoIds.length > 0 && s.videoIds.every((id) => ids.has(id)),
    `Broken/empty series: ${s.id}`,
  );
  assert(
    new Set(s.videoIds).size === s.videoIds.length,
    `Duplicate video in series: ${s.id}`,
  );
  assert(
    s.videoIds.every((id) =>
      c.videos.find((v) => v.id === id).seriesIds.includes(s.id),
    ),
    `Nonreciprocal series: ${s.id}`,
  );
}
console.log(
  `Catalog validated: ${ids.size} unique videos / ${series.size} series / ${units.size} units`,
);

const videoMap=new Map(c.videos.map(v=>[v.id,v]));const seriesMap=new Map(c.series.map(s=>[s.id,s]));const unitMap=new Map(c.units.map(u=>[u.id,u]));
for(const v of c.videos){const memberships=v.subjectIds||[v.subjectId];assert(memberships.includes(v.subjectId)&&new Set(memberships).size===memberships.length&&memberships.every(id=>subjects.has(id)),`Invalid subjects ${v.id}`);assert(v.unitIds.every(id=>memberships.includes(unitMap.get(id).subjectId)),`Cross-subject unit ${v.id}`);assert(v.seriesIds.every(id=>seriesMap.get(id).videoIds.includes(v.id)),`Missing reverse series reference ${v.id}`);}
for(const route of c.routes||[]){assert(route.id&&route.title&&route.steps.length,`Empty route ${route.id}`);for(const step of route.steps){const course=seriesMap.get(step.seriesId);assert(course,`Missing route series ${step.seriesId}`);assert((step.videoIds||course.videoIds).every(id=>course.videoIds.includes(id)&&videoMap.has(id)),`Invalid route selection ${route.id}`);}}
assert(new Set((c.routes||[]).map(r=>r.id)).size===(c.routes||[]).length,'Duplicate routes');
