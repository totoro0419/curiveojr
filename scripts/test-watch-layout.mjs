import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from './load-typescript.mjs';

const { catalog, videoMap, videoHref } = await loadTs('src/catalog.ts');
const { resolveWatchList } = await loadTs('src/lib/watch-list-context.ts');
const { courseOutline } = await loadTs('src/navigation/course-outline.ts');
const app = readFileSync('src/App.tsx','utf8');
const styles = readFileSync('src/styles.css','utf8');
const playlist = readFileSync('src/components/WatchPlaylist.tsx','utf8');

const toolbar = app.split('<div className="watch-toolbar">')[1].split('<div className="watch-layout">')[0];
const row = app.split('<div className="lesson-actions compact"')[1].split('</div>')[0];
assert.doesNotMatch(toolbar,/watch-next|次の授業へ/, 'No duplicate Next Lesson button in toolbar');
assert.ok(row.includes('Bookmark size={17}') && row.includes('className="watch-next study-next"'), 'Bookmark and Next must share the study-action row');
assert.ok(row.indexOf('Bookmark size={17}') < row.indexOf('className="watch-next study-next"'), 'Next must be after bookmark');
assert.match(row,/\{nextLesson&&<a className="watch-next study-next"/, 'Last lesson has no next link');
assert.match(row,/videoHref\(nextLesson,steps\.find\(step=>step\.videoId===nextLesson\.id\)\?\.seriesId\|\|series\?\.id,routeId,subjectContext,selection\.scope\)/,
  'Next must keep its course, route, subject and scoped playlist');
assert.match(row,/markAdvancedLesson\(\)/, 'Next explicitly advanced lesson should not become a false resume candidate');

assert.match(styles,/\.watch-playlist \{ grid-column:2;grid-row:1;display:flex;flex-direction:column;max-height:calc\(100dvh - 100px\);min-height:0;overflow:hidden; \}/);
assert.match(styles,/\.watch-playlist \.watch-sidebar \{[^}]*display:flex;flex-direction:column;flex:1 1 auto;min-height:0;/);
assert.match(styles,/\.watch-playlist \.episode-list \{[^}]*flex:1 1 auto;min-height:0;max-height:none;overflow-y:auto;/,
  'Playlist rows must be the only flexible vertical scrollbar');
assert.match(styles,/\.watch-playlist \.episode-list \{[^}]*scroll-padding-block:8px;padding-bottom:8px;/,
  'Last row requires clearance for duration text');
assert.match(styles,/\.watch-playlist \.chapter-targets \{[^}]*flex:0 1 auto;min-height:0;/,
  'Chapter links must not steal space from the final playlist row');
assert.match(styles,/\.watch-main \.lesson-actions \.study-next \{[^}]*margin-inline-start:auto;/,
  'Next action must be right aligned');
assert.match(playlist,/page:number/);
assert.match(playlist,/\[beside,currentId,page\]/);
assert.match(playlist,/list\.scrollTop=0;return;/);

const series = catalog.series.find(s => s.videoIds.length > 1 && courseOutline(s).some(group=>group.videoIds.length > 1));
assert.ok(series);
const selectedGroup = courseOutline(series).find(group => group.videoIds.length > 1);
assert.ok(selectedGroup);
const scope = 'outline:'+selectedGroup.id;
const selection = resolveWatchList(selectedGroup.videoIds[0],series.id,undefined,scope);
const selectedIndex = selection.ids.indexOf(selectedGroup.videoIds[0]);
const nextId = selection.ids[selectedIndex+1];
assert.equal(nextId,selectedGroup.videoIds[1]);
assert.equal(new URLSearchParams(videoHref(videoMap.get(nextId),series.id,undefined,undefined,selection.scope).split('?')[1]).get('playlist'),scope);
assert.equal(selection.ids[selection.ids.length],undefined,'Last lesson should have no further link');

console.log('Watch playlist clipping controls and in-row Next Lesson routing: PASS');
