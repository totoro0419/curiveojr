import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadTs} from './load-typescript.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const catalog=read('src/data/catalog.json');
const index=read('src/data/video-durations.json');
const metadata=read('data/video-metadata/durations.json').videos;
const statuses=read('src/data/duration-status.json');
const audit=read('data/video-metadata/duration-audit.json');
const ids=catalog.videos.map(v=>v.id);const unique=new Set(ids);
assert.equal(ids.length,unique.size);
assert.deepEqual(Object.keys(metadata).sort(),ids.toSorted());
assert.deepEqual(audit.videos.map(v=>v.videoId).sort(),ids.toSorted());
for(const [id,e] of Object.entries(metadata)){
 assert.match(id,/^[\w-]{11}$/);assert.equal(id,e.videoId);
 if(e.durationSeconds!==null){assert.ok(Number.isSafeInteger(e.durationSeconds)&&e.durationSeconds>0);assert.equal(index[id],e.durationSeconds);}
 if(e.status==='verified'){
  assert.equal(e.sourceVideoId,id);assert.ok(['youtube-data-api-v3','youtube-iframe-player-api'].includes(e.source));assert.ok(e.verifiedAt);assert.ok(e.refreshBy);
 }
 if(e.sourceVideoId!==null)assert.equal(e.sourceVideoId,id);
 assert.ok(statuses[id]);
 if(e.status==='reviewed_legacy'){assert.equal(e.sourceVideoId,id);assert.ok(e.identityEvidence);assert.ok(e.reviewedAt);assert.equal(e.verifiedAt,null);}
}
assert.ok(Object.keys(index).every(id=>unique.has(id)));
const {videoDuration,totalDuration,durationSummary,durationTime}=await loadTs('src/lib/duration.ts');
const sample=catalog.videos.find(v=>index[v.id]);
assert.equal(videoDuration(sample,{[sample.id]:{duration:1}}),index[sample.id]);
assert.equal(videoDuration({id:'test'},{test:{duration:0}}),null);
assert.equal(videoDuration({id:'test'},{test:{duration:1.5}}),null);
assert.equal(totalDuration([{id:'a',durationSeconds:1535},{id:'b',durationSeconds:1120},{id:'c',durationSeconds:1910},{id:'a',durationSeconds:1535}]).seconds,4565);
assert.equal(durationTime(4565),'1:16:05');
assert.equal(totalDuration([sample,sample]).seconds,index[sample.id]);
assert.equal(totalDuration([{id:'unknown'}]).missing,1);
assert.ok(!durationSummary([sample,{id:'unknown'}]).startsWith('合計 '));
if(!/^(verified|accepted)@/.test(statuses[sample.id]))assert.ok(!durationSummary([sample]).startsWith('合計 '));
const {learningNodes}=await loadTs('src/navigation/hierarchy.ts');
const {courseOutline}=await loadTs('src/navigation/course-outline.ts');
const {routeSequence}=await loadTs('src/catalog.ts');
const groups=[];
const check=(kind,id,title,videoIds,subjectId=null)=>{
 const dedup=[...new Set(videoIds)];assert.ok(dedup.every(id=>unique.has(id)));
 const videos=dedup.map(id=>catalog.videos.find(v=>v.id===id));
 const result=totalDuration(videos);
 const seconds=dedup.reduce((sum,id)=>sum+(index[id]??0),0);
 assert.equal(result.seconds,seconds);assert.equal(result.total,dedup.length);
 assert.equal(result.missing,dedup.filter(id=>!index[id]).length);
 groups.push({kind,id,title,subjectId,count:dedup.length,videos:dedup.map(videoId=>({videoId,durationSeconds:index[videoId]??null,status:statuses[videoId]})),recordedSeconds:seconds,acceptedTotalSeconds:result.missing||result.unverified?null:seconds,independentlyReverifiedTotalSeconds:dedup.every(id=>statuses[id].startsWith('verified@'))?seconds:null,recordedTime:durationTime(seconds),missing:result.missing,unverified:result.unverified});
};
for(const node of learningNodes.values())check(node.kind,node.id,node.title,node.videoIds,node.subjectId);
for(const unit of catalog.units)check('source-unit',unit.id,unit.name,catalog.videos.filter(v=>v.unitIds.includes(unit.id)).map(v=>v.id));
for(const series of catalog.series){
 check('series',series.id,series.title,series.videoIds);
 for(const group of courseOutline(series))check('course-group',group.id,group.title,group.videoIds);
}
for(const route of catalog.routes||[])check('route',route.id,route.title,routeSequence(route.id).map(s=>s.videoId));
assert.equal(audit.summary.total,ids.length);assert.equal(audit.summary.recorded,Object.keys(index).length);
const conflicts=Object.values(metadata).filter(e=>e.status==='conflict').length;assert.equal(audit.summary.conflicts,conflicts);
if(process.argv.includes('--report'))writeFileSync('data/video-metadata/duration-group-audit.json',JSON.stringify({groups},null,2)+'\n');
console.log(`Duration structure/arithmetic: PASS; ${ids.length} IDs, ${groups.length} groups. Recorded ${Object.keys(index).length}; conflicts ${conflicts}. Complete verification remains a separate gate.`);
