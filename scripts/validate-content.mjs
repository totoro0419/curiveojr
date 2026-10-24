import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadTs} from './load-typescript.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const source=read('src/data/catalog.json');
const audit=read('data/content/import-audit.json');
const {catalog,videoMap}=await loadTs('src/catalog.ts');
const {courseOutline}=await loadTs('src/navigation/course-outline.ts');
const {resolveWatchList}=await loadTs('src/lib/watch-list-context.ts');
const {totalDuration,remainingPlaylistSeconds}=await loadTs('src/lib/duration.ts');
assert.equal(source.videos.length,catalog.videos.length);
assert.equal(source.series.length,catalog.series.length);
assert.equal(new Set(source.videos.map(v=>v.id)).size,source.videos.length);
const expectedChannel=new Map(source.channels.map(ch=>[ch.id,ch.youtubeChannelId]));
for(const v of source.videos){
 const rt=videoMap.get(v.id);assert.ok(rt);
 for(const key of ['id','title','channelId','subjectId','order','role','durationSeconds','unitIds','seriesIds'])assert.deepEqual(rt[key],v[key],`${key}: ${v.id}`);
 assert.ok(v.originalTitle?.trim(),`Original title absent: ${v.id}`);
 assert.ok(v.uploaderName?.trim(),`Uploader absent: ${v.id}`);
 assert.equal(v.youtubeChannelId,expectedChannel.get(v.channelId),`Channel mismatch: ${v.id}`);
 assert.equal(v.sourceUrl,`https://www.youtube.com/watch?v=${v.id}`);
 assert.equal(v.availability.publicMetadata,'confirmed');
 assert.equal(v.availability.playback,'unverified','No unexecuted playback PASS');
 assert.ok(v.durationSeconds===null||(Number.isSafeInteger(v.durationSeconds)&&v.durationSeconds>0));
 if(v.durationSeconds){assert.ok(v.durationEvidence?.sourceUrl);assert.ok(['youtube-public-playlist','youtube-watch-page'].includes(v.durationEvidence.method));}
}
const unitMap=new Map(source.units.map(u=>[u.id,u]));
for(const s of source.series){
 const runtime=catalog.series.find(x=>x.id===s.id);assert.deepEqual(runtime.lessons,s.lessons);
 assert.equal(s.lessons.length,s.videoIds.length);
 assert.deepEqual(s.lessons.map(x=>x.videoId),s.videoIds);
 assert.equal(new Set(s.videoIds).size,s.videoIds.length);
 const sourceIds=audit.sourceOrders[s.id];let previous=0;
 for(const lesson of s.lessons){
  assert.ok(lesson.sourceOrder>previous,`Changed source order ${s.id}`);previous=lesson.sourceOrder;
  assert.equal(sourceIds[lesson.sourceOrder-1],lesson.videoId);
  const v=videoMap.get(lesson.videoId);assert.equal(v.channelId,s.channelId);assert.equal(v.subjectId,s.subjectId);
  assert.ok(v.unitIds.includes(lesson.unitId));assert.equal(unitMap.get(lesson.unitId)?.subjectId,s.subjectId);
 }
 assert.deepEqual(courseOutline(runtime).flatMap(x=>x.videoIds),s.videoIds,`Outline reordered ${s.id}`);
 const sequence=resolveWatchList(s.videoIds[0],s.id);assert.deepEqual(sequence.ids,s.videoIds,`Playback reordered ${s.id}`);
 const totals=totalDuration(s.videoIds.map(id=>videoMap.get(id)));
 const direct=s.videoIds.map(id=>videoMap.get(id));assert.equal(totals.seconds,direct.reduce((n,v)=>n+(v.durationSeconds||0),0));
 if(totals.missing===0)assert.equal(remainingPlaylistSeconds(direct,0,0),totals.seconds);
 else assert.equal(remainingPlaylistSeconds(direct,0,0),null);
}
for(const row of source.coverage){assert.ok(row.videoIds.every(id=>videoMap.get(id)?.subjectId===row.subjectId));assert.equal(row.status,row.videoIds.length?'listed':'missing');}
assert.ok(source.subjects.length===4);
for(const sid of ['mathematics','japanese','chemistry','japanese-history'])assert.ok(source.coverage.some(r=>r.subjectId===sid));
const missing=source.videos.filter(v=>v.durationSeconds===null);
console.log(JSON.stringify({status:'PASS',uniqueVideos:source.videos.length,courses:source.series.length,sourceOrderAndRuntimeChecks:source.series.length,durationKnown:source.videos.length-missing.length,durationMissing:missing.length,coverageRows:source.coverage.length,coverageWithoutEvidence:source.coverage.filter(r=>r.status==='missing').map(r=>r.topic)},null,2));
