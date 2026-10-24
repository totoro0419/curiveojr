import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/app-notifications.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { collectAppNotices } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const baseline = {
  learningError: "",
  syncState: "同期済み",
  pwaError: "",
  updateAvailable: false,
  online: true,
};
const collect = (state = {}) => collectAppNotices({ ...baseline, ...state });
const kinds = (state = {}) => collect(state).map((entry) => entry.kind);
const cases = [
  ["No false notice for healthy state", {}, []],
  ["Cloud access denied is routed to settings", { learningError: "Missing or insufficient permissions." }, ["learning"]],
  ["Sync status alone still signals an error", { syncState: "同期できません・端末に保存" }, ["learning"]],
  ["Cloud error and failing status do not duplicate", { syncState: "同期できません・端末に保存", learningError: "permission-denied" }, ["learning"]],
  ["PWA errors are notification data", { pwaError: "Update unavailable" }, ["pwa"]],
  ["Available app update is notification data", { updateAvailable: true }, ["update"]],
  ["Offline status is notification data", { online: false }, ["offline"]],
  ["All independent states are represented once", {
    learningError: "permission-denied", pwaError: "Update failed",
    updateAvailable: true, online: false,
  }, ["learning", "pwa", "update", "offline"]],
];
for (const [name, input, expected] of cases) {
  assert.deepEqual(kinds(input), expected, name);
  console.log("PASS", name);
}
assert.equal(collect({ learningError: "  Missing or insufficient permissions. " })[0].detail, "Missing or insufficient permissions.");
assert.ok(collect({ online: false })[0].detail.includes("端末内"));
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
assert.ok(!app.includes('className="offline-banner"'), "Remove global offline banner");
assert.ok(!app.includes('className="update-banner"'), "Remove global update banner");
assert.ok(!app.includes('<div className="notice error" role="alert">\n            {learning.error}'), "Remove global sync error banner");
assert.ok(app.includes('id="notifications"'), "Settings must host notification list");
assert.ok(app.includes('className="settings-alert-dot"'), "Settings icon must show notification indicator");
assert.ok(app.includes('className="icon-button watch-settings-link"'), "Mobile playback must expose settings");
console.log("Settings-notifications regression checks passed.");
