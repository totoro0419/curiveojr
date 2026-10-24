#!/usr/bin/env node
/**
 * Strict, auditable non-lesson pruning. Use YouTube's preserved originalTitle.
 * Keep uncertain cases for subsequent review rather than guessing.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const p='src/data/catalog.json',c=JSON.parse(readFileSync(p,'utf8'));
const VERSION=1;
if(c.nonLessonCleanup?.version===VERSION){console.log('Non-lesson cleanup already applied');process.exit(0);}
const rules=[
 ['channel-marketing',/チャンネル登録|メンバーシップ|会員登録|フォローのお願い|チャンネル(?:の|を)?紹介|登録者.{0,8}(?:突破|達成)/],
 ['sales-and-enrollment',/(?:テキスト|教材|書籍|新刊|問題集|参考書|電子書籍|本).{0,16}(?:販売|発売|増刷|購入|予約受付|申し込み|申込|買い方|買う)|(?:販売|発売|増刷|購入|予約受付|申込|申し込み).{0,16}(?:テキスト|教材|書籍|問題集|参考書|講座)/],
 ['promotion-or-notice',/^(?:【(?:重要な)?お知らせ】|お知らせ[！!。:：\s]|ご報告[！!。:：\s]|【ご報告】|緊急動画【|【緊急告知】|【告知】|重大発表|【宣伝】)|(?:参加者募集|募集開始|申し込み受付|申込受付|出版記念|予約販売|セミナー開催|イベント告知|受講生募集|体験授業のご案内|講座のご案内|公式LINE登録|キャンペーンのお知らせ|ライブ配信のお知らせ|ライブ配信予告)/],
 ['non-lesson-channel-news',/^(?:動画(?:が|を|の)?(?:完成|撮影|公開|投稿)|テキスト(?:が|を)?(?:完成|販売|発売)|受験相談(?:会|募集)|[0-9０-９]+万人(?:達成|突破)|チャンネル開設|自己紹介(?:動画)?$|はじめまして[！!。])/],
 ['instructions-or-preview',/^(?:【?(?:サンプル動画|オリエンテーション|講座紹介|使い方のご案内|説明会|授業の受け方)】?|無料(?:体験|相談)のご案内)/]
];
const suspect=/(?:お知らせ|告知|宣伝|募集|販売|発売|購入|申込|申し込み|増刷|出版|サンプル動画|チャンネル登録|メンバーシップ|入会|ご報告|緊急動画|動画を撮影|講座の紹介|テキスト購入|活動報告)/;
const removed=[],needsReview=[];
const deleted=new Set();
for(const v of c.videos){
 const original=(v.originalTitle||'').normalize('NFKC');
 const hit=rules.find(([id,re])=>re.test(original));
 if(hit){
  removed.push({videoId:v.id,originalTitle:v.originalTitle,previousDisplayTitle:v.title,channelId:v.channelId,seriesIds:v.seriesIds,reason:hit[0]});
  deleted.add(v.id);
 }else if(suspect.test(original)){
  needsReview.push({videoId:v.id,title:v.originalTitle,reason:'表題だけでは宣伝か授業か確定できない'});
 }
}
const preservedIds=new Set(c.videos.filter(v=>!deleted.has(v.id)).map(v=>v.id));
c.videos=c.videos.filter(v=>preservedIds.has(v.id));
for(const s of c.series){
 s.videoIds=s.videoIds.filter(id=>preservedIds.has(id));
 s.lessons=s.lessons.filter(l=>preservedIds.has(l.videoId));
 s.excludedCount=(s.excludedCount||0)+removed.filter(v=>v.seriesIds.includes(s.id)).length;
}
const emptySeries=new Set(c.series.filter(s=>s.videoIds.length===0).map(s=>s.id));
c.series=c.series.filter(s=>!emptySeries.has(s.id));
for(const v of c.videos)v.seriesIds=v.seriesIds.filter(id=>!emptySeries.has(id));
c.videos=c.videos.filter(v=>v.seriesIds.length>0);
const currentIds=new Set(c.videos.map(v=>v.id));
for(const route of c.routes||[]){
 route.steps=route.steps.filter(step=>!emptySeries.has(step.seriesId));
 for(const step of route.steps)if(step.videoIds)step.videoIds=step.videoIds.filter(id=>currentIds.has(id));
 route.steps=route.steps.filter(step=>!step.videoIds||step.videoIds.length>0);
}
c.routes=(c.routes||[]).filter(route=>route.steps.length>0);
for(const row of c.coverage||[]){
 row.videoIds=row.videoIds.filter(id=>currentIds.has(id));
 row.status=row.videoIds.length?'listed':'missing';
}
const allRemoved=new Set([...deleted,...new Set([...preservedIds].filter(id=>!currentIds.has(id)))]);
if(allRemoved.size>removed.length)throw Error('An unrelated lesson became orphaned. Halt until explicit review.');
for(const s of c.series){
 if(s.videoIds.length!==s.lessons.length||s.videoIds.some((id,i)=>id!==s.lessons[i].videoId))throw Error('Course order mismatch '+s.id);
}
c.nonLessonCleanup={version:VERSION,removedCount:removed.length,needsReviewCount:needsReview.length,rules:'strict-original-title'};
writeFileSync(p,JSON.stringify(c,null,2)+'\n');
mkdirSync('docs/content',{recursive:true});
writeFileSync('docs/content/NON_LESSON_REMOVAL.json',JSON.stringify({removed,needsReview},null,2)+'\n');
writeFileSync('docs/content/NON_LESSON_REMOVAL.md',
 '# 宣伝・非授業動画の削除結果\n\n'+
 '- 登録動画の元タイトルを照合した保守的な自動除外です。\n'+
 '- 削除動画: '+removed.length+'本。削除後: '+c.videos.length+'本。維持した講座: '+c.series.length+'件。\n'+
 '- 要確認（自動削除なし）: '+needsReview.length+'本。\n'+
 '- 宣伝と断定できないものは学習動画の誤削除を避けるため保留しました。\n'+
 '- 除外理由と元タイトル: [詳細JSON](NON_LESSON_REMOVAL.json)。\n'+
 '- 教材IDと既存学習記録は書き換えず、表示されるカタログと講座からのみ削除しました。\n'+
 '- 公式再生リストの収録数・順序は残った動画についての相対順を維持します。\n');
console.log('NON-LESSON PRUNE: '+JSON.stringify({removed:removed.length,remaining:c.videos.length,series:c.series.length,needsReview:needsReview.length}));
console.log('REMOVAL EXAMPLES '+JSON.stringify(removed.slice(0,30)));
