import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
assert.equal(c.displayTitleEdition?.version,1,'Title cleanup must be committed');
assert.equal(c.videos.length+(c.nonLessonCleanup?.removedCount||0),6849,'No unintended loss of lesson IDs');
assert.equal(new Set(c.videos.map(v=>v.id)).size,c.videos.length);
const subjectChanges=c.displayTitleEdition.changedBySubject;
assert.ok(Object.values(subjectChanges).reduce((a,b)=>a+b,0)>=100,'At least 100 titles should be clearer');
const byId=new Map(c.videos.map(v=>[v.id,v]));
for(const v of c.videos){
 assert.ok(v.title.trim().length>=1,'Empty title '+v.id);
 assert.ok(v.originalTitle?.trim(),'Original title missing '+v.id);
 assert.equal(v.sourceUrl,'https://www.youtube.com/watch?v='+v.id,'Video link mismatch '+v.id);
}
for(const s of c.series)assert.ok(s.videoIds.every(id=>byId.has(id)),'Missing video in '+s.id);
const lectureSeries=c.series.filter(s=>s.subjectId==='japanese-history'&&/【歴史第[一二三]期】/.test(s.title));
const originals=lectureSeries.flatMap(s=>s.videoIds).map(id=>byId.get(id));
const edited=originals.filter(v=>/^第\d{2}講｜/.test(v.title));
assert.ok(edited.length>=38,'Numbered history lectures not improved');
assert.ok(c.displayTitleEdition.changed <= 6849);
assert.ok(c.videos.some(v=>v.title!==v.originalTitle),'Edited headings must differ from official titles');
console.log('Display title integrity PASS: '+c.displayTitleEdition.changed+' titles edited');
