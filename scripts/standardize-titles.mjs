#!/usr/bin/env node
/** Curiveo Jr. display-title cleanup; preserves video identity and official originals. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const path='src/data/catalog.json';
const c=JSON.parse(readFileSync(path,'utf8'));
const VERSION=1;
if(c.displayTitleEdition?.version===VERSION){console.log('Already edited with version '+VERSION);process.exit(0);}
const originals=new Map(c.videos.map(v=>[v.id,{title:v.title,originalTitle:v.originalTitle}]));
const unitNames=new Map(c.units.map(u=>[u.id,u.name]));
const byId=new Map(c.videos.map(v=>[v.id,v]));
const examples=[],changedBySubject={};
function pretty(v){
 let title=v.title;
 const history=title.match(/^\s*【歴史】\s*((?:[0-9][\uFE0F]?\u20E3)+)\s*(.+)$/u);
 if(v.subjectId==='japanese-history'&&history){
  const no=Number(history[1].replace(/[^0-9]/g,''));
  if(no>=1&&no<=38)title='第'+String(no).padStart(2,'0')+'講｜'+history[2];
 }
 title=title.replace(/^\s*【偏差値60超えの(?:算数|理科|国語|社会)】\s*/,'発展｜')
  .replace(/^\s*偏差値60超えの(?:算数|理科|国語|社会)\s+/,'発展｜')
  .replace(/^\s*【算数文章題】\s*/,'文章題｜')
  .replace(/^\s*【社会地理】\s*/,'地理｜')
  .replace(/^\s*【社会公民】\s*/,'公民｜')
  .replace(/^\s*【中学受験】\s*/,'');
 title=title.replace(/【([^】]{1,35})】/g,(all,tag)=>{
  const t=tag.trim();
  if(/^(?:中学受験(?:算数|理科|国語|社会)?|中学入試|毎日配信|永久保存版|ループ再生推奨|SPI(?:対策)?|勉強法|動画解説|基礎|最終回|無料公開|最新動画|難関校向け)$/.test(t)||
     /^(?:ゼロから始める中学受験理科|特殊算攻略講座|図形問題基礎講座|理科苦手単元攻略講座)\s*(?:第?\d+回?)?$/.test(t))return '';
  if(/^偏差値60超え/.test(t))return '発展';
  return all;
 });
 title=title.replace(/^算数(?=[\u3040-\u30ff\u3400-\u9fff])/,'')
  .replace(/^理科(?=(?:生物|地学|物理|化学))/,'')
  .replace(/^社会(?=(?:地理|歴史|公民))/,'');
 title=title.replace(/^【([^】]{2,28})】\s*(.+)$/,(_full,topic,body)=>topic.trim()+'｜'+body.trim());
 const noise=[
  /中学受験(?:算数|理科|国語|社会)?・SPI対策・中学入試/g,
  /中学受験(?:算数|理科|国語|社会)?・SPI対策/g,
  /中学入試・SPI対策/g,
  /をサクッと学習しよう[!！]?/g,
  /この問題解けますか[？?]?/g,
  /塾が泣く[!！]?元大手塾講師の本気授業[!！]?/g,
  /受験生必見[!！]?/g,
  /完全マスター[!！]?/g,
  /【(?:毎日配信|永久保存版|ループ再生推奨|SPI対策|勉強法|無料公開)】/g
 ];
 for(const p of noise)title=title.replace(p,'');
 title=title.replace(/[\uFE0F\u20E3]/g,'');
 if(title.replace(/\p{Extended_Pictographic}/gu,'').replace(/[\s・｜]/g,'').length>=5)
  title=title.replace(/\p{Extended_Pictographic}/gu,'');
 title=title.replace(/(^|[｜・\s])中学受験(?=\s|[・｜])/g,'$1')
  .replace(/[!！]{2,}/g,'！').replace(/[?？]{2,}/g,'？');
 if(title.length>88){
  const head=title.match(/^(.{13,76}?)[。！？](?=\s*[^】])(?:[\s\S]+)$/u);
  if(head&&!/^(?:みんな|みなさん|これ|ここ|今回の動画|ぜひ|受験生)/.test(head[1]))
   title=head[1];
 }
 title=title.replace(/[ 　\t]{2,}/g,' ').replace(/\s*([：｜])\s*/g,'$1')
  .replace(/[:：｜]{2,}/g,'｜').replace(/^[・･：｜,、\s]+|[・･：｜,、\s]+$/g,'').trim();
 if(/^(?:これで完璧|知っていますか|全て解決)/.test(title)&&v.unitIds.length){
  const topic=unitNames.get(v.unitIds[0]);
  if(topic&&topic.length<30&&!title.includes(topic))title=topic+'｜'+title;
 }
 return title.length>=3?title:v.title;
}
for(const v of c.videos)v.title=pretty(v);
// Keep distinct videos distinguishable within the same provider course.
const reverted=new Set();
for(const s of c.series){
 const seen=new Map();
 for(const id of s.videoIds){
  const v=byId.get(id);if(!v)throw Error('Invalid course video '+id);
  const key=v.title.replace(/\s+/g,'');
  if(seen.has(key)&&originals.get(id).title!==originals.get(seen.get(key)).title){
   v.title=originals.get(id).title;reverted.add(id);
  }else seen.set(key,id);
 }
}
for(const v of c.videos){
 if(!v.title.trim()||v.originalTitle!==originals.get(v.id).originalTitle)throw Error('Integrity error '+v.id);
 if(v.title!==originals.get(v.id).title){
  changedBySubject[v.subjectId]=(changedBySubject[v.subjectId]||0)+1;
  if(examples.length<200)examples.push({id:v.id,subjectId:v.subjectId,channelId:v.channelId,from:originals.get(v.id).title,to:v.title});
 }
}
const changed=Object.values(changedBySubject).reduce((n,x)=>n+x,0);
c.displayTitleEdition={version:VERSION,method:'conservative-display-heading-cleanup',changed,changedBySubject};
writeFileSync(path,JSON.stringify(c,null,2)+'\n');
mkdirSync('docs/content',{recursive:true});
writeFileSync('docs/content/TITLE_EDIT_REPORT.md',
 '# Curiveo Jr. タイトル修正レポート\n\n'+
 '- 対象: '+c.videos.length+'本\n'+
 '- 変更: '+changed+'本 / 未変更: '+(c.videos.length-changed)+'本\n'+
 '- 教科別変更: '+JSON.stringify(changedBySubject)+'\n'+
 '- 編集後の同名化を防ぐため元の表示名へ戻した動画: '+reverted.size+'本\n'+
 '- 動画ID、元の公式タイトル originalTitle、講座内順序、再生時間は維持。\n'+
 '- 内容の全件視聴確認ではなく表示タイトルの初期整形です。\n'+
 '- 変更サンプル: docs/content/title-edit-examples.json\n');
writeFileSync('docs/content/title-edit-examples.json',JSON.stringify(examples,null,2)+'\n');
console.log('TITLE EDIT '+JSON.stringify({total:c.videos.length,changed,unchanged:c.videos.length-changed,bySubject:changedBySubject,reverted:reverted.size}));
for(const ex of examples.slice(0,35))console.log('EXAMPLE '+JSON.stringify(ex));
