import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='data/audits/2026-10-13';const read=path=>JSON.parse(readFileSync(path,'utf8'));
function csv(text){text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(!quote&&(ch===','||ch==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(ch==='\n'){rows.push(row);row=[];}}else cell+=ch;}if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const header=rows.shift();return rows.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]||''])));}
const selected=read(`${folder}/C_additional_videos_selected.json`).records;
const table=csv(readFileSync(`${folder}/C_additional_videos_selected.csv`,'utf8'));
assert.equal(selected.length,46);assert.equal(table.length,46);
for(const [i,record] of selected.entries())assert.deepEqual(Object.fromEntries(Object.entries(record).map(([k,v])=>[k,String(v)])),table[i],`CSV/JSON mismatch at ${i+1}`);
for(const [name,count] of [['A_curriculum_coverage_matrix.csv',158],['B_prioritized_gaps.csv',20],['C_deferred_videos.csv',5],['D_reclassification_instructions.csv',10]])assert.equal(csv(readFileSync(`${folder}/${name}`,'utf8')).length,count);
for(const item of read(`${folder}/input-manifest.json`))assert.equal(createHash('sha256').update(readFileSync(`${folder}/${item.file}`)).digest('hex'),item.sha256,`Altered original audit ${item.file}`);
const catalog=read('src/data/catalog.json'),base=read(`${folder}/baseline.json`),source=read('data/source-catalogs/audit-2026-10-13.json');
const videos=new Map(catalog.videos.map(v=>[v.id,v])),series=new Map(catalog.series.map(s=>[s.id,s])),units=new Set(catalog.units.map(u=>u.id));
assert.equal(catalog.mathveoSourceCommit,base.mathveoSourceCommit);
assert.equal(videos.size,catalog.videos.length);
for(const id of base.videoIds){assert(videos.has(id),`Removed original ${id}`);assert.equal(videos.get(id).curriculum,base.curriculum[id],`Changed original curriculum ${id}`);}
for(const [id,ids] of Object.entries(base.seriesOrders))assert.deepEqual(series.get(id)?.videoIds,ids,`Reordered old series ${id}`);
for(const id of base.unitIds)assert(units.has(id),`Removed old unit ${id}`);
assert.equal(new Set(selected.map(r=>r.youtube_video_id)).size,46);
for(const r of selected){const v=videos.get(r.youtube_video_id);assert(v,`Missing selected ${r.youtube_video_id}`);assert.equal(v.availability?.publicMetadata,'confirmed');assert.equal(v.availability?.embedMetadata,'allowed');assert.equal(v.availability?.playback,'unverified');assert.equal(r.youtube_url,`https://www.youtube.com/watch?v=${v.id}`);}
const ordered=(name)=>selected.filter(row=>row.シリーズ===name).sort((a,b)=>Number(a.series_order)-Number(b.series_order)).map(row=>row.youtube_video_id);
assert.deepEqual(series.get('taniguchi-math-b-statistics').videoIds,ordered('新課程数学B：統計的な推測'));
assert.deepEqual(series.get('chowakaru-chemistry-aliphatic').videoIds,ordered('脂肪族化合物'));
assert.deepEqual(series.get('tadayobi-listening-2021').videoIds,ordered('共通テスト リスニング対策講座'));
assert.match(series.get('tadayobi-listening-2021').title,/2021/);assert.match(series.get('tadayobi-listening-2021').notice,/現在/);
const shared=videos.get('FGmjzr7mOag');assert.deepEqual(shared.subjectIds,['japanese-history','world-history']);assert.equal(shared.unitIds.filter(id=>catalog.units.find(u=>u.id===id)?.subjectId==='world-history').length,1);
assert.equal(catalog.chapterIndex.length,153);for(const r of catalog.chapterIndex){const ch=videos.get(r.videoId)?.chapters?.[r.chapterIndex];assert(ch);assert.equal(ch.startSeconds,r.startSeconds);assert.equal(ch.title,r.title);}
const added=catalog.videos.filter(v=>!base.videoIds.includes(v.id));assert.equal(added.length,46);assert.equal(catalog.videos.length,2322);
console.log(`Audit validated: 9 unchanged input files, 46 CSV/JSON matches, ${base.videoIds.length} original IDs and ${Object.keys(base.seriesOrders).length} series preserved, 46 additions, shared history ID, 153 chapter references.`);
