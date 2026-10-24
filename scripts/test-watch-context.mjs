import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTs} from './load-typescript.mjs';

const {catalog, videoMap, seriesMap, videoHref, routeSequence} = await loadTs('src/catalog.ts');
const {courseOutline} = await loadTs('src/navigation/course-outline.ts');
const {learningNodes} = await loadTs('src/navigation/hierarchy.ts');
const {listKey} = await loadTs('src/lib/list-key.ts');
const {resolveWatchList, saveWatchList} = await loadTs('src/lib/watch-list-context.ts');
const {remainingPlaylistSeconds, remainingDurationLabel} = await loadTs('src/lib/duration.ts');

const series = catalog.series.find(s => s.videoIds.length > 3 && courseOutline(s).length > 1);
assert.ok(series, 'A multi-chapter course must exist');
const chapter = courseOutline(series).find(c => c.videoIds.length > 0 && c.videoIds.length < series.videoIds.length);
assert.ok(chapter);
const chapterScope = 'outline:'+chapter.id;
const selected = resolveWatchList(chapter.videoIds[0], series.id, undefined, chapterScope);
assert.deepEqual(selected.ids, chapter.videoIds, 'Course outline must not leak other lessons');
assert.equal(selected.scope, chapterScope);
assert.equal(selected.title, chapter.title);
assert.deepEqual(resolveWatchList(chapter.videoIds[0],series.id).ids, series.videoIds, 'Legacy course links still work');

let nodeExample;
for(const node of learningNodes.values()){
  for(const s of catalog.series){
    const within = s.videoIds.filter(id => node.videoIds.includes(id));
    if(within.length>0 && within.length<s.videoIds.length){nodeExample={node,series:s,within};break;}
  }
  if(nodeExample)break;
}
assert.ok(nodeExample, 'A topic smaller than a full course must exist');
assert.deepEqual(resolveWatchList(nodeExample.within[0],nodeExample.series.id,undefined,'node:'+nodeExample.node.id).ids,
  nodeExample.within, 'Topic selection preserves source-course ordering');

const route = (catalog.routes||[]).find(r=>r.steps.length>1 && r.steps.some(s=>(s.videoIds??seriesMap.get(s.seriesId)?.videoIds??[]).length>0));
assert.ok(route);
const stepIndex=route.steps.findIndex(s=>(s.videoIds??seriesMap.get(s.seriesId)?.videoIds??[]).length>0);
const step = route.steps[stepIndex];
const stepIds = [...new Set(step.videoIds??seriesMap.get(step.seriesId)?.videoIds??[])];
const scope = 'route-step:'+stepIndex;
assert.deepEqual(resolveWatchList(stepIds[0],step.seriesId,route.id,scope).ids, stepIds,
  'Route chapter must not include the rest of the route');
assert.deepEqual(resolveWatchList(stepIds[0],step.seriesId,route.id).ids,
  routeSequence(route.id).map(s=>s.videoId), 'Unscoped route keeps whole-route behavior');

const snapshot = new Map();
globalThis.sessionStorage = {
  setItem(key,value){snapshot.set(key,value);},
  getItem(key){return snapshot.get(key)??null;},
};
const ids=catalog.videos.slice(10,14).map(v=>v.id);
const savedScope='saved:'+listKey(ids);
saveWatchList(savedScope,ids,'お気に入り');
assert.deepEqual(resolveWatchList(ids[1],undefined,undefined,savedScope).ids,ids);
assert.equal(resolveWatchList(ids[1],undefined,undefined,savedScope).title,'お気に入り');
const deepLink=videoHref(videoMap.get(ids[1]),undefined,undefined,undefined,savedScope);
assert.equal(new URLSearchParams(deepLink.split('?')[1]).get('playlist'),savedScope);
assert.equal(resolveWatchList(ids[1],undefined,undefined,'saved:invalid').scope,undefined);

const mock=[
 {id:'mock-a',durationSeconds:600}, {id:'mock-b',durationSeconds:1200},
 {id:'mock-c',durationSeconds:300},
];
assert.equal(remainingPlaylistSeconds(mock,0,120),1980);
assert.equal(remainingPlaylistSeconds(mock,1,600),900);
assert.equal(remainingPlaylistSeconds(mock,2,300),0);
assert.equal(remainingPlaylistSeconds(mock,2,0),300);
assert.equal(remainingPlaylistSeconds(mock,0,700),1500);
assert.equal(remainingPlaylistSeconds(mock,0,120,{},900),2280);
assert.equal(remainingPlaylistSeconds(mock,0,120,{},NaN),1980);
assert.equal(remainingPlaylistSeconds(mock,-1,0),null);
assert.equal(remainingPlaylistSeconds([...mock,{id:'missing'}],0,0),null);
assert.equal(remainingDurationLabel(1980),'33分');
assert.equal(remainingDurationLabel(1980,2),'17分');
assert.equal(remainingDurationLabel(3600),'1時間');
assert.equal(remainingDurationLabel(0),'0分');

const app=readFileSync('src/App.tsx','utf8');
const list=readFileSync('src/components/catalog-ui.tsx','utf8');
const hierarchy=readFileSync('src/pages/HierarchyPage.tsx','utf8');
assert.match(app,/resolveWatchList\(/);
assert.match(app,/remainingPlaylistSeconds\(/);
assert.match(app,/onProgress=\{progress=>/);
assert.match(app,/subjectContext,selection\.scope\)/);
assert.match(list,/videoHref\(v, seriesId,routeId,subjectId,sourceScope\)/);
assert.ok(hierarchy.includes('playlistScope={' + String.fromCharCode(96) + 'outline:'));
assert.ok(hierarchy.includes('playlistScope={' + String.fromCharCode(96) + 'node:'));
assert.ok(hierarchy.includes('playlistScope={' + String.fromCharCode(96) + 'route-step:'));
console.log('Source-scoped playback lists, remaining time and link propagation: PASS');
