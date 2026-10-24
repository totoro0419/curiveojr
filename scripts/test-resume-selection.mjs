import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/resume-selection.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { selectResumeRecommendation: choose } = await import(
  "data:text/javascript;base64," + Buffer.from(transpiled).toString("base64")
);

const video = (id) => ({ id, durationSeconds: 600, seriesIds: ["course"] });
const videos = ["one", "two", "three"].map(video);
const series = [{ id: "course", videoIds: videos.map((v) => v.id) }];
const record = (id, fields = {}) => ({
  videoId: id, status: "learning", playbackEnded: false, resumeDismissed: false,
  position: 120, duration: 600, watchedSeconds: 80, lastViewedAt: 100,
  ...fields,
});
const select = (records, videoList = videos, courses = series) => choose(videoList, courses, records);
const selected = (records, videoList, courses) => select(records, videoList, courses)?.video.id ?? null;
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  console.log("PASS", name);
};

check("Recent seek-only skim does not displace meaningful study",
  selected({
    one: record("one", { lastViewedAt: 100 }),
    two: record("two", { lastViewedAt: 500, watchedSeconds: 3, position: 420 }),
  }), "one");

check("Missing watchedSeconds in old records uses conservative position fallback",
  selected({ one: record("one", { watchedSeconds: undefined, position: 150 }) }), "one");

check("Tiny legacy visit is not promoted",
  selected({ one: record("one", { watchedSeconds: undefined, position: 10 }) }), null);

check("Fresh seek to 80 percent without watch does not count",
  selected({ one: record("one", { watchedSeconds: 0, position: 480 }) }), null);

check("Explicit suppression beats recent engagement",
  selected({ one: record("one", { resumeDismissed: true }) }), null);

check("Completed latest lecture opens next in same course",
  select({ one: record("one", { status: "completed", lastViewedAt: 500 }) }),
  { video: videos[1], kind: "next", previousVideoId: "one", seriesId: "course" });

check("Skip already completed and dismissed follow-on lessons",
  selected({
    one: record("one", { status: "completed", lastViewedAt: 500 }),
    two: record("two", { status: "completed", lastViewedAt: 200 }),
  }), "three");

check("Near end of lecture uses next lesson rather than repeat final seconds",
  selected({ one: record("one", { position: 594, lastViewedAt: 500 }) }), "two");

check("No fabricated continuation beyond last lesson",
  selected({ three: record("three", { playbackEnded: true }) }), null);

check("Unrelated courses are never considered a continuation",
  selected({ one: record("one", { status: "completed" }) }, videos, []), null);

check("Unstarted saved bookmarks are not auto-recommended",
  selected({ one: record("one", { status: "unstarted" }) }), null);

check("When the newest episode is excluded, use next eligible one",
  selected({
    one: record("one", { lastViewedAt: 400, resumeDismissed: true }),
    two: record("two", { lastViewedAt: 100 }),
  }), "two");

console.log("12 resume-selection checks passed.");
