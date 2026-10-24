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
assert.equal(label('SU7oEOnUxSQ').title,'反応速度とは');
assert.equal(label('Xwzoc-x92QU').title,'反応速度式');
assert.equal(label('g8ly6uWpFoA').title,'活性化エネルギー・反応速度を変える条件');
assert.ok(label('g8ly6uWpFoA').detail.includes('#3'));
const duplicateSeries = catalog.series.find(s =>
  s.videoIds.slice(0,2).every(id => byId.get(id)?.title.includes('単項式・多項式・次数・係数')));
assert.ok(duplicateSeries,'Expected source-series duplicate');
const firstTwo = duplicateSeries.videoIds.slice(0,2).map(label);
assert.equal(firstTwo[0].title,firstTwo[1].title);
assert.notEqual(firstTwo[0].detail,firstTwo[1].detail,'Duplicate lesson labels need distinct sequence numbers');

const mundi = catalog.videos.find(v => v.channelId==='mundi');
assert.ok(mundi);
assert.ok(playlistLessonLabel(mundi).title.length < mundi.title.length,'Source series branding should be hidden');

const tadayobi = catalog.videos.find(v=>v.channelId==='tadayobi'&&v.title.includes('第1講'));
assert.ok(tadayobi);
assert.ok(playlistLessonLabel(tadayobi).detail.includes('#1'),'Tadayobi lecture number must remain');
const taniguchi = catalog.videos.find(v=>v.channelId==='taniguchi'&&v.topic);
assert.ok(taniguchi);
assert.equal(playlistLessonLabel(taniguchi).title,taniguchi.topic);
assert.ok(playlistLessonLabel(taniguchi).detail.includes('#1'));

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
