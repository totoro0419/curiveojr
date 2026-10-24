import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/navigation/history-periods.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { historyPeriod, historyPeriodFromUnit, historyPeriodForVideo, japaneseHistoryPeriodFromTitle, JAPANESE_HISTORY_PERIODS } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const boundaries = [
  [1, 7, "縄文・弥生"],
  [8, 23, "古墳・飛鳥"],
  [24, 29, "奈良"],
  [30, 48, "平安"],
  [49, 61, "鎌倉"],
  [62, 77, "室町・南北朝"],
  [78, 88, "戦国・安土桃山"],
  [89, 123, "江戸"],
  [124, 130, "幕末"],
  [131, 155, "明治"],
  [156, 163, "大正"],
  [164, 187, "昭和"],
  [188, 189, "平成"],
  [190, 200, "近現代の文化史"],
];
assert.deepEqual(JAPANESE_HISTORY_PERIODS.map(p => p.label), boundaries.map(([, , label]) => label));
for (const [start, end, expected] of boundaries) {
  for (let number = start; number <= end; number++) {
    const title = String(number).padStart(3, "0") + " 日本史ストーリーノート";
    assert.equal(japaneseHistoryPeriodFromTitle(title), expected, title);
    assert.equal(historyPeriodForVideo("japanese-history", { title }, "第6話 混在する章"), expected, title);
  }
}
for (const title of ["", "文化史", "201 日本史", "第6話 平安・鎌倉", "999 未登録", "0123 数字", "1 単元"]) {
  assert.equal(japaneseHistoryPeriodFromTitle(title), undefined, title);
}
// Deliberately ambiguous Japanese provider chapters must not be used as eras.
assert.equal(historyPeriodFromUnit("japanese-history", "第6話 平安〜鎌倉"), undefined);
for (const [chapter, expected] of [
  [1, "古代文明・地中海世界"],
  [4, "アジア・イスラーム世界"],
  [9, "中世ヨーロッパ"],
  [11, "近世ヨーロッパ"],
  [13, "近現代の欧米"],
  [17, "近現代のアジア"],
  [20, "戦後の世界"],
]) assert.equal(historyPeriod("world-history", chapter), expected);
assert.equal(historyPeriodFromUnit("world-history", "第２０話 戦後の世界"), "戦後の世界");
for (const chapter of [-1, 0, 21, 42, 1.5, NaN]) assert.equal(historyPeriod("world-history", chapter), undefined);
assert.equal(historyPeriod("mathematics", 1), undefined);

const sourceDurations = JSON.parse(readFileSync("src/data/history-duration-supplement.json", "utf8"));
const firstSevenIds = ["O0TOWEBjXa8", "ABFgnonvlsQ", "_zIu3JEvMSU", "GIimcbhuvfw", "fg8UK5IGO5Q", "Sfyx43bDKOs", "uvYb3oaAjDM"];
assert.equal(firstSevenIds.reduce((sum, id) => sum + sourceDurations[id], 0), 14070, "Preserve historical evidence pending original-ID verification");
for (const [id, value] of Object.entries(sourceDurations)) {
  assert.match(id, /^[A-Za-z0-9_-]{11}$/);
  assert.ok(Number.isSafeInteger(value) && value > 0);
}
const unifiedDurations = JSON.parse(readFileSync("src/data/video-durations.json", "utf8"));
const evidence = JSON.parse(readFileSync("data/video-metadata/durations.json", "utf8")).videos;
for (const [id, value] of Object.entries(sourceDurations)) {
 assert.ok(evidence[id].legacyEvidence.some(e=>e.location==="src/data/history-duration-supplement.json"&&e.durationSeconds===value), "Legacy evidence must survive migration");
 assert.equal(unifiedDurations[id],evidence[id].durationSeconds);
}
assert.ok(!readFileSync("src/lib/duration.ts", "utf8").includes("historyMetadata"), "Runtime must use a single index");

const catalog = JSON.parse(readFileSync("src/data/catalog.json", "utf8"));
const videos = new Map(catalog.videos.map(video => [video.id, video]));
const units = new Map(catalog.units.map(unit => [unit.id, unit]));
const data = [];
for (const subjectId of ["japanese-history", "world-history"]) {
  const series = catalog.series.filter(series => series.subjectId === subjectId);
  assert.ok(series.length);
  const supported = series.filter(course => course.videoIds.every(id => {
    const video = videos.get(id);
    return video.unitIds.some(unitId => {
      const unit = units.get(unitId);
      return unit?.subjectId === subjectId && historyPeriodForVideo(subjectId, video, unit.name);
    });
  }));
  assert.ok(supported.length, "No source-backed era course for " + subjectId);
  for (const course of supported) {
    const labels = course.videoIds.map(id => {
      const video = videos.get(id);
      const unit = video.unitIds.map(uid => units.get(uid)).find(unit =>
        unit?.subjectId === subjectId && historyPeriodForVideo(subjectId, video, unit.name));
      return historyPeriodForVideo(subjectId, video, unit.name);
    });
    const groups = [];
    for (const [index, label] of labels.entries()) {
      if (!index || labels[index - 1] !== label) groups.push([]);
      groups.at(-1).push(course.videoIds[index]);
    }
    assert.deepEqual(groups.flat(), course.videoIds, "Course order and IDs must be retained");
    if (subjectId === "japanese-history" && course.id === "mundi-japan") {
      assert.equal(new Set(labels).size, boundaries.length, "All expected eras must appear");
      assert.equal(labels[47], "平安");
      assert.equal(labels[48], "鎌倉");
      assert.equal(labels[60], "鎌倉");
      assert.equal(labels[61], "室町・南北朝");
      assert.equal(labels[129], "幕末");
      assert.equal(labels[130], "明治");
      assert.equal(labels[186], "昭和");
      assert.equal(labels[187], "平成");
    }
  }
  data.push({ subjectId, series: series.length, supported: supported.length });
}
const hierarchy = readFileSync("src/pages/HierarchyPage.tsx", "utf8");
assert.ok(hierarchy.includes("label:'時代から探す'"));
assert.ok(hierarchy.includes("historySubject?'topics':'courses'"));
assert.ok(hierarchy.includes('meta={durationSummary(videos,learning.records)}'));
assert.ok(hierarchy.includes('className="group-duration"'));
const disclosure = readFileSync("src/components/Disclosure.tsx", "utf8");
assert.ok(disclosure.includes('className="disclosure-meta"'));
console.log("History era boundary and sequence tests passed:", data);
