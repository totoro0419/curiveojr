import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from './load-typescript.mjs';

const {catalog} = await loadTs('src/catalog.ts');
const {playlistLessonLabel} = await loadTs('src/lib/playlist-lesson-label.ts');
const byId = new Map(catalog.videos.map(v => [v.id,v]));
const label = id => {
  const video=byId.get(id);
  assert.ok(video,'Unknown test video '+id);
  return playlistLessonLabel(video);
};
for(const video of catalog.videos){
  const result = playlistLessonLabel(video);
  assert.ok(result.title && result.title.trim().length>0,'Empty playlist title '+video.id);
  assert.ok(!/[\r\n]/.test(result.title),'Multiline playlist title '+video.id);
  assert.ok(result.detail.length < 45,'Unbounded detail '+video.id);
  assert.deepEqual(result,playlistLessonLabel(video),'Nondeterministic label '+video.id);
}
// Jr. catalog uses entrance-exam lessons; do not require the parent's high-school IDs.
const keitaku=catalog.videos.find(v=>v.channelId==='keitaku'&&v.title==='和差算①');
assert.ok(keitaku);assert.equal(label(keitaku.id).title,'和差算①');
const vocabulary=catalog.videos.find(v=>v.channelId==='genius'&&v.title.startsWith('語彙'));
assert.ok(vocabulary);assert.ok(label(vocabulary.id).title.includes('語彙'));
const multi=catalog.videos.find(v=>v.seriesIds.length>1);
assert.ok(multi,'Repeated source references share one learning record');
assert.deepEqual(label(multi.id),playlistLessonLabel(multi));

const app=readFileSync('src/App.tsx','utf8');
const css=readFileSync('src/styles.css','utf8');
assert.match(app,/const lessonLabel=playlistLessonLabel\(episode\)/);
assert.match(app,/<Thumb video=\{episode\} className="episode-thumbnail"\/>/);
assert.match(app,/className="episode-title" title=\{episode.title\}>\{lessonLabel.title\}/);
assert.match(app,/className="episode-duration">\{\[lessonLabel.detail,duration!==null\?durationTime\(duration\)/);
assert.match(css,/\.watch-playlist \.episode-list a > \.episode-thumb-wrap \{[^}]*flex:0 0 64px/);
assert.match(css,/\.watch-playlist \.episode-list a > \.episode-copy \{[^}]*min-width:0;/);
assert.match(css,/\.episode-duration \{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis;/);
assert.match(css,/\.watch-playlist \.episode-list \{[^}]*padding-bottom:8px;/);
console.log('Playlist labels and thumbnails: PASS ('+catalog.videos.length+' videos)');
