import {catalog,unitMap,videoMap} from '../catalog';
import type {Video} from '../types';

// Only the author's first, second and third historical lecture playlists.
const sources=catalog.series.filter(s=>s.subjectId==='japanese-history'&&s.channelId==='sakurara'&&/【歴史第[一二三]期】/.test(s.title))
 .sort((a,b)=>'一二三'.indexOf(a.title.match(/歴史第([一二三])期/)?.[1]||'')-'一二三'.indexOf(b.title.match(/歴史第([一二三])期/)?.[1]||''));

// Numbered 【歴史】 lessons are the core. Notices, study advice,
// compilations and advanced social studies are never core lectures.
export function numberedHistoryLecture(title:string):number|null{
 const edited=title.match(/^第(\d{1,2})講[｜\s]/u);
 if(edited){const n=Number(edited[1]);return n>=1&&n<=38?n:null;}
 const found=title.match(/^\s*【歴史】\s*((?:[0-9][\uFE0F]?\u20E3)+)/u);
 if(!found)return null;
 const value=Number(found[1].replace(/[^0-9]/g,''));
 return Number.isInteger(value)&&value>=1&&value<=38?value:null;
}
const lessons=new Map<number,Video>();
for(const course of sources)for(const id of course.videoIds){
 const video=videoMap.get(id);
 if(!video)continue;
 const no=numberedHistoryLecture(video.title);
 if(no!==null&&!lessons.has(no))lessons.set(no,video);
}
export const historyNumbers=[...lessons.keys()].sort((a,b)=>a-b);
export const historyCoreVideos=historyNumbers.map(n=>lessons.get(n)!);
export const historyCoreComplete=historyNumbers.length===38&&historyNumbers.every((n,i)=>n===i+1);
const intervals=[
 ['ancient','旧石器・縄文・弥生',1,3],['asuka','古墳・飛鳥',4,5],
 ['nara','奈良',6,7],['heian','平安',8,10],
 ['kamakura','鎌倉',11,14],['muromachi','室町・戦国',15,19],
 ['azuchi','安土桃山',20,21],['edo','江戸・幕末',22,26],
 ['meiji','明治',27,30],['taisho','大正',31,32],['showa','昭和・戦後',33,38]
] as const;
export const historyEras=intervals.map(([id,title,first,last])=>({
 id,title,first,last,videos:historyNumbers.filter(n=>first<=n&&n<=last).map(n=>lessons.get(n)!)
}));
const core=new Set(historyCoreVideos.map(v=>v.id));
const inHistorySource=new Set(sources.flatMap(s=>s.videoIds));
const notLesson=/勉強法|学習法|テキスト|購入|お知らせ|ご報告|速報|緊急動画|受験相談|合格体験|ライブ配信|チャンネル登録|告知|入会|宣伝|講座紹介|無料配布|質問募集/;
export const historySupplementVideos=catalog.videos.filter(video=>
 video.subjectId==='japanese-history'&&!core.has(video.id)&&inHistorySource.has(video.id)&&
 !notLesson.test(video.title)&&
 video.unitIds.some(id=>unitMap.get(id)?.field==='歴史')&&
 /歴史|時代|幕府|文化|王朝|天皇|政治|戦国|江戸|明治|鎌倉|室町|昭和|大正|弥生|縄文|古墳|飛鳥|奈良|平安/.test(video.title)
);
