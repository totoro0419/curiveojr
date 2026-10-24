import {readFileSync,writeFileSync} from 'node:fs';
const folder='data/audits/2026-10-13';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const selected=read(`${folder}/C_additional_videos_selected.json`).records;
const verified=new Map(read(`${folder}/video-verification.json`).map(row=>[row.id,row]));
const existing=read('src/data/catalog.json');
const baseline=read(`${folder}/baseline.json`);const originalIds=new Set(baseline.videoIds);const originalVideos=existing.videos.filter(v=>originalIds.has(v.id));
const out={channels:[],units:[],series:[],videos:[],videoPatches:[],unitPatches:[],routes:[],chapterIndex:[],gaps:[]};
const sid={数学:'mathematics',英語:'english',化学:'chemistry',国語:'japanese',日本史:'japanese-history','情報Ⅰ':'information'};
const channelIds={'たにぐち授業ちゃんねる':'taniguchi',TNSKee:'tnskee','超わかる！授業動画':'chowakaru','マサの高校化学':'masa-chemistry','歴史総合・世界史探究のミカタ':'history-mikata','東北大学CDS-OCW':'tohoku-ocw','ただよび 文系チャンネル（吉武優）':'tadayobi','岡崎健太のOK塾':'ok-juku'};
const roles={'基礎講義':'core','問題演習':'exam','補完講義':'reinforcement','発展・補完':'advanced','演習・解法講義':'exam','作品解説':'reinforcement'};
const seriesIds={'新課程数学B：統計的な推測':'taniguchi-math-b-statistics','仮説検定 補完講義':'tnskee-hypothesis-testing','脂肪族化合物':'chowakaru-chemistry-aliphatic','無機化学 反応原理':'chowakaru-chemistry-inorganic-principles','高分子の理解補強':'masa-natural-polymers','歴史総合 第一部':'mikata-history-modernization','Pythonによる統計学入門':'tohoku-python-simulation','共通テスト リスニング対策講座':'tadayobi-listening-2021','高校国語教科書 作品解説':'ok-juku-modern-works'};
const unit=(id,subjectId,level,field,name,path,extra={})=>{if(!out.units.some(u=>u.id===id))out.units.push({id,subjectId,level,field,name,path,order:out.units.length+1000,classificationStatus:'title-supported',evidence:'監査2026-10-13の指定区分とYouTube正式タイトルに基づく。授業全編の精査ではない。',...extra});return id;};
const patch=(id,unitId,note)=>{let row=out.videoPatches.find(x=>x.id===id);if(!row){row={id,addUnitIds:[],classificationEvidenceAppend:note};out.videoPatches.push(row);}if(!row.addUnitIds.includes(unitId))row.addUnitIds.push(unitId);};
const adopted=[],held=[];
for(const row of selected){
 const id=row.youtube_video_id,m=verified.get(id);
 if(!m||m.publicMetadata!=='confirmed'||m.embedMetadata!=='allowed'){held.push({id,reason:m?.error||m?.embedReason||'公開メタデータまたは埋め込み許可が未確認'});continue;}
 const subjectId=sid[row.教科],channelId=channelIds[row.チャンネル];let seriesId=seriesIds[row.シリーズ];if(subjectId==='japanese')seriesId+=row.科目==='文学国語'?'-literary':'-logical';
 if(!subjectId||!channelId||!seriesId||!roles[row.役割])throw new Error(`Unmapped audit record ${id}`);
 if(!['chowakaru','mundi','passlabo','stardy','yobinori','tadayobi','sekachan'].includes(channelId)&&!out.channels.some(c=>c.id===channelId))out.channels.push({id:channelId,name:channelId==='tnskee'?`${row.チャンネル} / ${m.uploaderName}`:m.uploaderName,url:m.uploaderUrl,description:channelId==='tohoku-ocw'?'大学公式OCWの発展・補完講義':'監査で選定した講座・補完講義'});
 let level=row.科目,field=row.分野,name=row.単元,topic=row.小単元;
 if(subjectId==='chemistry')field=field==='有機化合物'?'有機化合物の性質':field==='無機物質'?'無機物質の性質':field;
 if(id==='S04AT5Za2HY')topic='アミノ酸';
 if(subjectId==='english')name='共通テスト形式演習（2021年度形式）';
 const unitId=unit(`audit-${subjectId}-${subjectId==='mathematics'?row.単元==='仮説検定'?'hypothesis':Number(row.series_order)<=14?'distribution':Number(row.series_order)<=19?'sample':'estimation':subjectId==='chemistry'?channelId==='masa-chemistry'?'natural-polymers':row.単元==='脂肪族化合物'?'aliphatic':'inorganic-principles':subjectId==='english'?'listening-2021':subjectId==='japanese'?row.科目==='文学国語'?'literary-essay':'logical-essay':subjectId==='information'?'simulation':'modernization'}`,subjectId,level,field,name,[level,field,name].filter((value,i,array)=>i===0||value!==array[i-1]));
 const unitIds=[unitId],subjectIds=[subjectId];
 if(id==='FGmjzr7mOag'){subjectIds.push('world-history');unitIds.push(unit('audit-world-history-modernization','world-history',level,field,name,[level,name]));}
 if(!out.series.some(s=>s.id===seriesId))out.series.push({id:seriesId,title:subjectId==='japanese'?`高校国語教科書 作品解説（${row.科目}）`:seriesId==='tadayobi-listening-2021'?'共通テスト リスニング対策（2021年度形式）':seriesId==='masa-natural-polymers'?'天然高分子の補講：アミノ酸':seriesId==='tohoku-python-simulation'?'Pythonによる統計学入門 — シミュレーション編':row.シリーズ,channelId,subjectId,...(subjectIds.length>1?{subjectIds}:{}),level,sourceUrl:row.playlist_url||row.確認できた根拠URL,coverage:`監査選定分のみ収録。出典: ${row.確認できた根拠URL}。公開メタデータと埋め込み許可を再確認。実再生は別途検証。`,...(seriesId==='tadayobi-listening-2021'?{notice:'2021年度の共通テスト形式を扱う解法・演習講座です。現在の試験形式の案内や、基礎音声訓練の代替ではありません。'}:seriesId==='tohoku-python-simulation'?{notice:'大学公式OCWの発展補講です。情報Ⅰの基礎講座は、せかチャンの講義・チャプターから学べます。'}:{})});
 const order=Number(row.series_order)||1;
 out.videos.push({id,title:m.title,channelId,subjectId,...(subjectIds.length>1?{subjectIds}:{}),level,field,unit:name,unitId,unitIds,topic,seriesIds:[seriesId],seriesOrders:{[seriesId]:order},order,role:roles[row.役割],sourceUrl:row.確認できた根拠URL,curriculum:subjectId==='english'?'legacy':subjectId==='mathematics'?'current':'unverified',verification:'verified',uploaderName:m.uploaderName,availability:{publicMetadata:'confirmed',embedMetadata:'allowed',playback:'unverified',checkedAt:m.embedCheckedAt||m.checkedAt},classificationEvidence:`監査指定: ${row.科目} / ${row.分野} / ${row.単元} / ${topic}。正式タイトル・投稿元をYouTube oEmbedで照合。${row.採用理由}${id==='S04AT5Za2HY'?' 正式原題はアミノ酸。タンパク質全般の解説は未確認。':''}`,auditOriginalTitle:row['動画タイトル_識別用（原題表記は根拠URL優先）']});adopted.push(id);
}
// Extra references are additive. Original unit/series/video keys and curriculum flags remain.
const chemField={inorganic:['無機物質の性質','無機化学の演習・総復習'],organic:['有機化合物の性質','有機化学の演習・総復習'],polymer:['高分子化合物','高分子の演習・総復習']};
for(const [key,[field,name]] of Object.entries(chemField))unit(`audit-chemistry-${key}-practice`,'chemistry','化学',field,name,['化学',field,name]);
for(const video of originalVideos.filter(v=>v.seriesIds.includes('chowakaru-chemistry-15'))){
 const t=video.title.normalize('NFKC');let kind;
 if(/高分子|アミノ酸|タンパク質/.test(t))kind='polymer';else if(/有機|炭化水素|脂肪族|油脂|セッケン|芳香族|フェノール|カルボン酸|構造決定/.test(t))kind='organic';else if(/無機|ハロゲン|硫黄|窒素|気体の製法|アルカリ金属|2族元素|両性元素|鉄・銅・銀/.test(t))kind='inorganic';
 if(kind)patch(video.id,`audit-chemistry-${kind}-practice`,'公開授業名に明記された分野へ演習・総復習参照を追加。元の30本講座と授業順は保持。');
}
// Integer curriculum correspondence is partial: only explicit officially covered title topics get a new reference.
const integers=unit('audit-math-a-integer-activities','mathematics','数学A','数学と人間の活動','整数・記数法（旧課程講座の対応部分）',['数学A','数学と人間の活動','整数・記数法（旧課程講座の対応部分）'],{evidence:'文科省数学解説の数学Aに約数・倍数・ユークリッドの互除法・二進法が明記。公開動画名に明示されたもののみ参照。数学史等の網羅は未確認。'});
for(const video of originalVideos.filter(v=>v.seriesIds.includes('PLd3yb0oVJ_W0T_e62uPntx5TtIIbNJfxn'))){if(/約数|倍数|互いに素|互除法|進法|進数/.test(video.title))patch(video.id,integers,'現行数学A「数学と人間の活動」の整数・記数法に、正式教材名で対応する参照を追加。旧課程タグ・元単元・元講座は保持。');}
// Avoid evaluating a Mathematics I conceptual lecture as a full Mathematics B calculation lesson.
// xg3mAYn83ao is preserved; no cross-reference is committed without inspecting the actual lesson content.
const jpStage={
 'tadayobi-gendaibun-1':['現代文','読解の基礎'],'tadayobi-gendaibun-2':['現代文','読解の基礎'],'tadayobi-gendaibun-12':['現代文','読解の基礎'],
 'tadayobi-gendaibun-3':['現代文','設問・記述'],'tadayobi-gendaibun-7':['現代文','設問・記述'],'tadayobi-gendaibun-4':['現代文','補講・総まとめ'],'tadayobi-gendaibun-11':['現代文','補講・総まとめ'],
 'tadayobi-gendaibun-5':['現代文','共通テスト・入試演習'],'tadayobi-gendaibun-6':['現代文','共通テスト・入試演習'],'tadayobi-gendaibun-8':['現代文','共通テスト・入試演習'],
 'tadayobi-kobun-7':['古文','入門'],'tadayobi-kobun-1':['古文','基礎の定着'],'tadayobi-kobun-2':['古文','解釈'],'tadayobi-kobun-4':['古文','記述演習'],
 'tadayobi-kanbun-1':['漢文','句法・基礎'],'tadayobi-kanbun-2':['漢文','基礎の定着'],'tadayobi-kanbun-4':['漢文','記述演習']};
for(const series of existing.series.filter(s=>/^tadayobi-(gendaibun|kobun|kanbun)-/.test(s.id))){const stage=jpStage[series.id]||[series.id.includes('kobun')?'古文':'漢文','共通テスト・入試演習'];const title=series.title.replace(/^【?現代文】?\s*/,'');const id=unit(`audit-unit-${series.id}`,'japanese',series.level,stage[0],title,[...stage,title],{classificationStatus:'title-supported',evidence:`ただよび公式講座名「${series.title}」による学習段階分類。現行科目の細目への対応・作品本文は未確認。`});for(const videoId of series.videoIds)patch(videoId,id,'ただよび公式講座名で基礎・解釈・記述・入試の学習段階を追加。旧シリーズと元単元を保持。');}
// Theme indices use explicit words in the original official lecture titles only.
for(const subjectId of ['japanese-history','world-history']){
 const themes=[['culture','文化史',/文化|美術|文学|思想|宗教|仏教/],['economy','社会・経済史',/経済|産業|農業|貿易|商業|社会/],['diplomacy','外交・国際関係',/外交|対外|条約|国際|東西交流/]];
 for(const [key,title,pattern] of themes){const members=originalVideos.filter(v=>v.subjectId===subjectId&&pattern.test(v.title));if(!members.length)continue;const id=unit(`audit-${subjectId}-theme-${key}`,subjectId,'高校','テーマ別',title,['テーマ別',title],{evidence:'公式授業タイトルの明示語による索引。史資料探究の実践・科目全体の適合を保証しない。'});for(const v of members)patch(v.id,id,'公式授業タイトルの明示テーマで索引を追加。通史200本の順序と既存単元は保持。');}
}
// Chapter indices are references into existing videos, never new video records.
for(const video of originalVideos.filter(v=>v.subjectId==='information')){
 const u=existing.units.find(u=>video.unitIds.includes(u.id));const fields=['情報社会の問題解決','コミュニケーションと情報デザイン','コンピュータとプログラミング','情報通信ネットワークとデータの活用'];
 const field=fields.find(f=>u?.name.startsWith(f));
 for(const [index,chapter] of (video.chapters||[]).entries())out.chapterIndex.push({videoId:video.id,chapterIndex:index,title:chapter.title,startSeconds:chapter.startSeconds,field:field||null,classificationStatus:field?'source-field':'needs-review',evidence:field?`公式元講座の分野「${u.name}」。章内の細目・全内容の適合は未検証。`:'元講座の4領域対応を確認できないため未確定'});
}
const route=(id,title,subjectIds,steps,description)=>out.routes.push({id,title,subjectIds,steps,description});
route('math-b-statistics','数学B 統計的な推測',['mathematics'],[{seriesId:'taniguchi-math-b-statistics',label:'確率分布 → 標本分布 → 推定（公式 #1〜#22）'},{seriesId:'tnskee-hypothesis-testing',label:'仮説検定の補完講義'}],'22本の連続講義の後に仮説検定を学びます。講師が切り替わる補完講義を分けて表示します。');
const chemicalIds=kind=>out.videoPatches.filter(p=>p.addUnitIds.includes(`audit-chemistry-${kind}-practice`)).map(p=>p.id);
for(const [id,title,base,kind] of [['chemistry-aliphatic','脂肪族化合物：基礎から演習','chowakaru-chemistry-aliphatic','organic'],['chemistry-inorganic','無機化学：反応原理から演習','chowakaru-chemistry-inorganic-principles','inorganic'],['chemistry-polymers','天然高分子：アミノ酸の補講と復習','masa-natural-polymers','polymer']])route(id,title,['chemistry'],[{seriesId:base,label:'基礎・理解の補講'},{seriesId:'chowakaru-chemistry-15',videoIds:chemicalIds(kind),label:'既存の時短演習・総復習'}],'選定した基礎・補講を先に、その後に既存の演習を配置。未選定の系統講義は補完していません。');
route('kobun-foundation','古文：入門から解釈・演習',['japanese'],['tadayobi-kobun-7','tadayobi-kobun-1','tadayobi-kobun-2','tadayobi-kobun-4','tadayobi-kobun-3'].map(seriesId=>({seriesId})),'公式講座名が示す入門→定着→解釈→記述→過去問。各講座内の順序を保持。');
route('kanbun-foundation','漢文：句法から読解・演習',['japanese'],['tadayobi-kanbun-1','tadayobi-kanbun-2','tadayobi-kanbun-4','tadayobi-kanbun-3'].map(seriesId=>({seriesId})),'基礎55講→アウトプット50講→記述19講→過去問11講。各講座内の順序を保持。');
// The original A/B/D judgements remain immutable; implementation decisions are kept separately.
const gaps=read(`${folder}/prioritized-gaps.json`);
const gapStates=gaps.map((gap,index)=>{const state=index<2?'selected-implemented':gap.今回の選定動画?'partial-implemented':'unresolved';const reason=index<2?'指定講義を収録。授業全編の細目・演習充分性は未精査':gap.今回の選定動画?'選定済み教材を追加したが、基礎技能や系統講義全体の不足・未確認は残る':gap.状態;return {...gap,implementationStatus:state,remainingReason:reason};});
for(const gap of gapStates.filter(g=>g.implementationStatus!=='selected-implemented'))out.gaps.push({subjectId:sid[gap.教科]||gap.教科,reason:`${gap.不足内容}: ${gap.remainingReason}。今後の対応: ${gap.推奨対応}。監査の細目は全編未精査。`});
writeFileSync(`${folder}/prioritized-gap-status.json`,JSON.stringify(gapStates,null,2)+'\n');
writeFileSync('data/source-catalogs/audit-2026-10-13.json',JSON.stringify(out,null,2)+'\n');
writeFileSync(`${folder}/integration-decisions.json`,JSON.stringify({adopted,held,existingTitleDuplicatesForNewWorks:originalVideos.filter(v=>v.subjectId==='japanese'&&/陰翳|民主主義|谷崎|高橋/.test(v.title)).map(v=>v.id),reclassification:{mathIConcept:'内容の再生確認未了につき元分類を保持し数学Bへ無条件参照追加しない',legacyFlags:'既存122 legacy/900 mixedを保持',integerCorrespondence:'公式細目と動画タイトル対応部分のみ追加参照。未対応分は旧単元から閲覧可能',chemistry:'明示タイトル29件のみ分野別参照。重要反応式総まとめ1本は内容未確認',japanese:'22講座を学習段階で索引。現行科目・本文対応は未確定',history:'通史順序を維持。公式授業タイトルで確認できるテーマのみ索引',information:'153章を元講座の4分野で対応付け。細目の完全精査は未了'}},null,2)+'\n');
console.log(`Audit source generated: ${adopted.length} adopted, ${held.length} held, ${out.videoPatches.length} additive references, ${out.routes.length} learning routes`);
