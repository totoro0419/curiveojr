import {readFileSync,writeFileSync} from 'node:fs';
const path='src/data/catalog.json';
const c=JSON.parse(readFileSync(path,'utf8'));
if(c.displayTitleEdition?.polishVersion===1){console.log('Title polish already applied');process.exit(0);}
if(c.displayTitleEdition?.version!==1)throw Error('Apply first pass before polish');
const byId=new Map(c.videos.map(v=>[v.id,v]));
let polished=0;
for(const v of c.videos){
 const before=v.title;
 const match=before.match(/^偏差値60超えの(?:理科|算数|国語|社会)(\d{1,3})(.+)$/);
 if(match){
  const no=Number(match[1]),topic=match[2].trim();
  if(no>=1&&no<=200&&topic.length>=3)v.title='発展 第'+String(no).padStart(2,'0')+'回｜'+topic;
 }
 if(v.id==='mcEOQfZOBMI'&&v.originalTitle==='中学受験 算数 動画解説 速さ㊴ 時計算1 基礎')
  v.title='時計算①｜基本';
 if(before!==v.title){
  polished++;
  if(v.id==='mcEOQfZOBMI'){
   c.displayTitleEdition.changed++;
   c.displayTitleEdition.changedBySubject[v.subjectId]=(c.displayTitleEdition.changedBySubject[v.subjectId]||0)+1;
  }
 }
}
c.displayTitleEdition.polishVersion=1;
c.displayTitleEdition.furtherPolished=polished;
writeFileSync(path,JSON.stringify(c,null,2)+'\n');
const report='docs/content/TITLE_EDIT_REPORT.md';
const old=readFileSync(report,'utf8').replace(/変更: \d+本 \/ 未変更: \d+本/,'変更: '+c.displayTitleEdition.changed+'本 / 未変更: '+(c.videos.length-c.displayTitleEdition.changed)+'本')
 .replace(/教科別変更: .+/,'教科別変更: '+JSON.stringify(c.displayTitleEdition.changedBySubject))
 .replace(/原題が短すぎて内容を判定できない要確認タイトル: \d+本/,'原題が短すぎて内容を判定できない要確認タイトル: '+c.videos.filter(v=>v.title.length<3).length+'本');
writeFileSync(report,old+'\n- 二次整形: '+polished+'本。発展理科の講義番号と「時計算①｜基本」を明確化。\n');
console.log('POLISHED '+polished+' titles');
