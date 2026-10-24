import {loadTs} from './load-typescript.mjs';
const {catalog,videoMap,unitMap}=await loadTs('src/catalog.ts');
for(const subject of catalog.subjects){
 console.log('===SUBJECT '+subject.id+' '+subject.name+' ===');
 console.log('units fields '+[...new Set(catalog.units.filter(u=>u.subjectId===subject.id).map(u=>u.field))].join(' / '));
 const courses=catalog.series.filter(s=>s.subjectId===subject.id);
 for(const s of courses){
  if(subject.id!=='japanese-history' && !(/けいたく|国語|クイックラーニング|１から学ぶ|算数基礎/.test(s.title)))continue;
  const vs=s.videoIds.map(id=>videoMap.get(id));
  console.log('COURSE '+JSON.stringify({id:s.id,title:s.title,channel:s.channelId,n:vs.length,roleCount:Object.fromEntries([...new Set(vs.map(v=>v.role))].map(role=>[role,vs.filter(v=>v.role===role).length])),order:s.orderBasis}));
  if(subject.id==='japanese-history')for(const [i,v] of vs.entries())if(i<16||i%9===0||i>=vs.length-3)console.log('VIDEO '+i+' '+v.id+' | '+v.title+' | '+v.unitIds.map(id=>unitMap.get(id)?.field+':'+unitMap.get(id)?.name).join(', ')+' | '+v.role);
 }
}
