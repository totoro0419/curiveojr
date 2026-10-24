import {readFileSync} from 'node:fs';
const j=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
for(const sub of j.subjects) {
 const all=j.videos.filter(v=>v.subjectId===sub.id);
 console.log('==== SUBJECT '+sub.name+' ('+all.length+') ====');
 const channels=[...new Set(all.map(v=>v.channelId))];
 for(const ch of channels){
  const vs=all.filter(v=>v.channelId===ch);
  const choices=[...vs.slice(0,6),...vs.filter(v=>/【|[!！?？]|#|202[4-9]|(?:勉強法|受験|解ける)/.test(v.title)).slice(0,10),...vs.slice(-3)];
  const dedup=new Map(choices.map(v=>[v.id,v]));
  console.log('-- '+ch+' '+vs.length);
  for(const v of dedup.values())console.log(JSON.stringify({id:v.id,title:v.title,originalTitle:v.originalTitle,unit:v.unitIds[0]}));
 }
}