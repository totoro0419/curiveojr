import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const reference = process.argv[2] || "../mathveo-reference";
const sources =
  process.argv.length > 3
    ? process.argv.slice(3)
    : [
        "data/source-catalogs/science.json",
        "data/source-catalogs/humanities.json",
        "data/source-catalogs/supplement.json",
        "data/source-catalogs/audit-2026-10-13.json",
      ];
const inventory = JSON.parse(
  readFileSync(`${reference}/src/data/registered-videos.json`, "utf8"),
);
const playlists = [
  ...readFileSync(`${reference}/src/data/playlists.ts`, "utf8").matchAll(
    /\{\s*title:\s*"([^"]+)",\s*id:\s*"([^"]+)",\s*original:\s*"([^"]+)",\s*current:\s*"([^"]+)"/g,
  ),
].map((m) => ({ title: m[1], id: m[2], original: m[3], current: m[4] }));
const subjects = [
  ["mathematics", "数学", "数学", "基礎から微積分、入試演習まで", "Sigma"],
  ["english", "英語", "英語", "文法をつなげて、読む・書く力へ", "Languages"],
  ["chemistry", "化学", "化学", "物質のしくみを基礎から理解", "FlaskConical"],
  ["physics", "物理", "物理", "力学から原子まで、原理を学ぶ", "Atom"],
  ["japanese", "国語", "国語", "現代文・古文・漢文を整理", "BookOpen"],
  [
    "japanese-history",
    "日本史",
    "日本史",
    "時代をたどり、流れをつかむ",
    "Landmark",
  ],
  ["world-history", "世界史", "世界史", "世界のつながりを通史で学ぶ", "Globe"],
  ["information", "情報Ⅰ", "情報Ⅰ", "情報のしくみと共通テスト対策", "Binary"],
].map(([id, name, shortName, description, icon]) => ({
  id,
  name,
  shortName,
  description,
  icon,
}));
const channels = [
  [
    "chowakaru",
    "超わかる！授業動画",
    "https://www.youtube.com/@chowakaru",
    "基礎・標準の体系的な授業",
  ],
  [
    "mundi",
    "Historia Mundi / ムンディ先生",
    "https://mundisensei.com/",
    "日本史・世界史の通史",
  ],
  [
    "passlabo",
    "PASSLABO",
    "https://www.youtube.com/channel/UC7ly4Q6oT3rcdOKQcQVvMgg",
    "受験演習・英語の理解補強",
  ],
  [
    "stardy",
    "河野玄斗の神授業 / Stardy",
    "https://www.youtube.com/channel/UCySNyY7ZlIyIeQ0T_8ah4Vg",
    "数学の網羅講義・受験対策",
  ],
  [
    "yobinori",
    "予備校のノリで学ぶ「大学の数学・物理」",
    "https://yobinori.jp/",
    "高校物理の理解補強と発展講義",
  ],
  ["tadayobi", "ただよび", "https://tadayobi.com/", "物理・国語の体系講義"],
  ["sekachan", "せかチャン", "https://sekachan.net/", "情報Ⅰ・共通テスト対策"],
].map(([id, name, url, description]) => ({ id, name, url, description }));
const units = [],
  series = [],
  videos = new Map();
const levelNames = {
  I: "数学Ⅰ",
  A: "数学A",
  II: "数学Ⅱ",
  B: "数学B",
  III: "数学Ⅲ",
  C: "数学C",
  junior: "中学数学",
  special: "総復習・入試",
};
for (const [index, p] of playlists.entries()) {
  const ids = inventory.units.find((u) => u.id === p.id)?.videoIds || [];
  if (!ids.length) continue;
  const level = levelNames[p.current] || "高校数学";
  const unitId = `math-${p.id}`;
  units.push({
    id: unitId,
    subjectId: "mathematics",
    level,
    field: level,
    name: p.title,
    order: index,
  });
  series.push({
    id: p.id,
    title: `超わかる！ ${p.title}`,
    channelId: "chowakaru",
    subjectId: "mathematics",
    level,
    sourceUrl: `https://www.youtube.com/playlist?list=${p.id}`,
    videoIds: ids,
    coverage: `Mathveoの公式講座収録を引継ぎ。${ids.length}本。再生可否は全件未検査。`,
  });
  for (const [order, id] of ids.entries()) {
    const v = inventory.videos.find((v) => v.id === id);
    if (!v) throw new Error(`Mathveo reference missing: ${id}`);
    const existing = videos.get(id);
    if (existing) {
      existing.unitIds.push(unitId);
      existing.seriesIds.push(p.id);
      continue;
    }
    videos.set(id, {
      id,
      title: v.title,
      channelId: "chowakaru",
      subjectId: "mathematics",
      level,
      unitIds: [unitId],
      seriesIds: [p.id],
      order,
      role: p.current === "special" ? "exam" : "core",
      sourceUrl: `https://www.youtube.com/playlist?list=${p.id}`,
      verification:
        v.classification === "verified" ? "verified" : "needs-review",
      curriculum: p.current !== p.original ? "legacy" : "mixed",
      durationSeconds: v.durationSeconds,
      classificationEvidence: v.classificationEvidence,
    });
  }
}
// The remaining Mathveo videos are imported only when its reviewed metadata identifies mathematics.
for (const v of inventory.videos) {
  if (videos.has(v.id)) continue;
  if (v.classification !== "verified" || !v.currentSubjects?.length) continue;
  const level = "総復習・入試",
    unitId = "math-supplement";
  if (!units.some((u) => u.id === unitId))
    units.push({
      id: unitId,
      subjectId: "mathematics",
      level,
      field: level,
      name: "補足講義・入試演習",
      order: 999,
    });
  videos.set(v.id, {
    id: v.id,
    title: v.title,
    channelId: "chowakaru",
    subjectId: "mathematics",
    level,
    unitIds: [unitId],
    seriesIds: [],
    order: videos.size,
    role: v.supplementalCategory === "exam" ? "exam" : "reinforcement",
    sourceUrl: `https://www.youtube.com/watch?v=${v.id}`,
    verification: "verified",
    curriculum: "unverified",
    durationSeconds: v.durationSeconds,
    classificationEvidence: v.classificationEvidence,
  });
}
const gaps = [];
const seriesOrders = new Map();
const patches=[], unitPatches=[], routes=[], chapterIndex=[];
for (const file of sources) {
  if (!existsSync(file)) throw new Error(`Input not found: ${file}`);
  const input = JSON.parse(readFileSync(file, "utf8"));
  for(const channel of input.channels || []){if(!channels.some(c=>c.id===channel.id))channels.push(channel);}
  for(const unit of input.units || []){if(!units.some(u=>u.id===unit.id))units.push(unit);}
  patches.push(...(input.videoPatches||[]));unitPatches.push(...(input.unitPatches||[]));routes.push(...(input.routes||[]));chapterIndex.push(...(input.chapterIndex||[]));
  for (const s of input.series || []) {
    if (!series.some((x) => x.id === s.id))
      series.push({
        ...s,
        videoIds: [],
        coverage:
          s.coverage ||
          "公式一覧から取得した確認済み動画を収録。全動画の再生可否は未検査。",
      });
  }
  for (const v of input.videos || []) {
    const level = v.level || "高校",
      name = v.unit || "講座全体";
    const unitId =
      v.unitId ||
      `${v.subjectId}-${createHash("sha256").update(`${level}:${name}`).digest("hex").slice(0, 12)}`;
    if (!units.some((x) => x.id === unitId))
      units.push({
        id: unitId,
        subjectId: v.subjectId,
        level,
        field: v.field || level,
        name,
        order: v.unitOrder ?? units.length,
      });
    const unitIds=[...new Set([unitId,...(v.unitIds||[])])];
    const sids = v.seriesIds || [];
    const existing = videos.get(v.id);
    if (existing) {
      existing.unitIds = [...new Set([...existing.unitIds, ...unitIds])];
      existing.seriesIds = [...new Set([...existing.seriesIds, ...sids])];
    } else
      videos.set(v.id, {
        ...v,
        uploaderName: v.uploaderName || v.channelName,
        youtubeChannelId: v.youtubeChannelId || v.uploaderYouTubeId,
        level,
        unitIds,
        seriesIds: sids,
        curriculum: ["current", "legacy", "mixed"].includes(v.curriculum)
          ? v.curriculum
          : "unverified",
        durationSeconds: v.durationSeconds ?? null,
        verification:
          v.verification === "needs-review" ? "needs-review" : "verified",
        classificationEvidence:
          v.classificationEvidence ||
          `公式の講座目次または公開再生リストの授業名・順序に基づく分類。内容の詳細は未確認。出典: ${v.evidenceUrl || v.sourceUrl}`,
      });
    for (const sid of sids) {
      const s = series.find((s) => s.id === sid);
      if (!s) throw new Error(`Missing series ${sid}`);
      if (!s.videoIds.includes(v.id)) s.videoIds.push(v.id);
      seriesOrders.set(`${sid}:${v.id}`, v.seriesOrders?.[sid] ?? v.order);
    }
  }
  gaps.push(...(input.gaps || []));
  for (const f of input.failures || []) {
    const s = series.find((s) => s.id === f.seriesId);
    if (s) {
      const reason = `${s.title}: 公式ページ掲載${f.publishedCount}本のうち公開取得は${f.imported}本。残りは未収録。`;
      gaps.push({ channelId: s.channelId, subjectId: s.subjectId, reason });
      s.coverage = reason;
    }
  }
}
for(const patch of unitPatches){const u=units.find(u=>u.id===patch.id);if(!u)throw new Error(`Missing patch unit ${patch.id}`);Object.assign(u,patch);}
for(const patch of patches){const video=videos.get(patch.id);if(!video)throw new Error(`Missing patch video ${patch.id}`);for(const id of patch.addUnitIds||[])if(!units.some(u=>u.id===id))throw new Error(`Missing patch target ${id}`);video.unitIds=[...new Set([...video.unitIds,...(patch.addUnitIds||[])])];if(patch.classificationEvidenceAppend&&!video.classificationEvidence.includes(patch.classificationEvidenceAppend))video.classificationEvidence+=` ${patch.classificationEvidenceAppend}`;}
for (const s of series)
  s.videoIds = s.videoIds
    .filter((id) => videos.has(id))
    .sort(
      (a, b) =>
        (seriesOrders.get(`${s.id}:${a}`) ?? 0) -
        (seriesOrders.get(`${s.id}:${b}`) ?? 0),
    );
const data = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  mathveoSourceCommit: execFileSync(
    "git",
    ["-C", reference, "rev-parse", "HEAD"],
    { encoding: "utf8" },
  ).trim(),
  subjects,
  channels,
  units,
  series,
  videos: [...videos.values()],
  gaps,
  routes,
  chapterIndex,
};
mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/catalog.json", JSON.stringify(data));
const counts = Object.fromEntries(
  subjects.map((s) => [
    s.name,
    data.videos.filter((v) => (v.subjectIds||[v.subjectId]).includes(s.id)).length,
  ]),
);
console.log(
  JSON.stringify(
    {
      videos: videos.size,
      series: series.length,
      units: units.length,
      counts,
      mathveoRegistered: inventory.videos.length,
    },
    null,
    2,
  ),
);
