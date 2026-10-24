import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
const removed=JSON.parse(readFileSync('docs/content/NON_LESSON_REMOVAL.json','utf8'));
const byId=new Map(catalog.videos.map(v=>[v.id,v]));
const deleted=new Set(removed.removed.map(r=>r.videoId));
assert.ok(catalog.nonLessonCleanup?.version===1,'Catalog must be pruned');
assert.equal(6849,catalog.videos.length+deleted.size,'No unrelated video was removed');
assert.equal(deleted.size,catalog.nonLessonCleanup.removedCount);
assert.ok(deleted.size>0,'Strict rules must remove known promotions');
assert.equal(removed.removed.length,deleted.size);
for(const id of deleted)assert.ok(!byId.has(id),'Promotion still visible in catalog: '+id);
for(const series of catalog.series){
 assert.ok(series.videoIds.length>0);
 assert.deepEqual(series.videoIds,series.lessons.map(l=>l.videoId));
 assert.ok(series.videoIds.every(id=>byId.has(id)),'Dangling playlist reference');
}
for(const route of catalog.routes)assert.ok(route.steps.every(step=>catalog.series.some(s=>s.id===step.seriesId)));
for(const row of catalog.coverage||[])assert.ok(row.videoIds.every(id=>byId.has(id)));
assert.ok(catalog.videos.every(v=>v.seriesIds.every(id=>catalog.series.some(s=>s.id===id))));
console.log('Promotion exclusion PASS: '+deleted.size+' removed, '+catalog.videos.length+' lessons retained; '+removed.needsReview.length+' require manual review');
