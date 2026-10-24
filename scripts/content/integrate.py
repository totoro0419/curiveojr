#!/usr/bin/env python3
"""Deterministic, fail-closed catalog build from checked-in source evidence.
No network, no inferred video IDs/durations; catalog is deduplicated by YouTube ID.
"""
from pathlib import Path
import json,re,hashlib,collections,unicodedata
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'data/content'
def read(name):return json.loads((D/name).read_text())
def write(path,x):
 (ROOT/path).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def slug(s):return hashlib.sha256(s.encode()).hexdigest()[:12]
def norm(s):return unicodedata.normalize('NFKC',s).replace('\u20e3','').replace('\ufe0f','')
STAMP='2026-10-24'
old=json.loads((ROOT/'src/data/catalog.json').read_text())
channels=[
 ('keitaku','けいたくチャンネル','UC3LgVYRHHKxo0RkziCsgp6g','https://www.youtube.com/channel/UC3LgVYRHHKxo0RkziCsgp6g','基礎を順に学ぶ算数。公式コース順で収録。'),
 ('risukan','【中学受験算数】理数館の算数の人','UCOiKRFPEfq9T04MRxOYPdCQ','https://sansu.online/','公式単元目次に沿った解法・考え方の学習。'),
 ('kobachan','こばちゃん塾','UCVxg1EE8Efu6M2WyYg6zYPA','https://www.youtube.com/@katekyo-aspiration','算数の基礎・特殊算と理科の連続講義。'),
 ('quick','クイックラーニング',None,'https://kyoiku.info/quick-learning/','公式目次に基づく算数・理科。基礎・標準・応用を区別。'),
 ('sakurara','中学受験さくららチャンネル','UCFOADXtB3WbWlHSasEJIeJA','https://www.youtube.com/@sakurara','社会の主軸。国語の読解・記述・知識、算数・理科の単元講義。'),
 ('genius','0時間目のジーニアス','UCNPyqS6vleJk5gYKOPHsJYg','https://www.youtube.com/@genius_zero','語彙を場面で学ぶ語彙コント、記述添削解説。'),
 ('kokugo','「国語を得意に!」〜中学入試応援チャンネル〜','UCmcD5XGxrK3_ZMLaLdQY_sA','https://www.youtube.com/channel/UCmcD5XGxrK3_ZMLaLdQY_sA','指示語・対比・理由・心情記述の読み方を補強。'),
 ('sugimoto','すぎもとの中学受験サポートch(灘・東大・外コン卒家庭教師)','UCD5PvkhF9ksClU5VGvHCyZw','https://www.youtube.com/@sugimotoK','選択肢問題の解き方を補強。'),
 ('doctor','受験Dr.','UCKc516BVG_Yg-_c70jxQVlg','https://www.youtube.com/channel/UCKc516BVG_Yg-_c70jxQVlg','物語文・随筆・心情記述の読み方を補強。'),
 ('suiri','マスラボ','UCOMxK0EEfzZndajNUzcpN1w','https://www.youtube.com/channel/UCOMxK0EEfzZndajNUzcpN1w','中学受験算数の条件整理・推理を補強。'),
 ('lab','観るだけで賢くなる理科の話','UC5-lOB3_zMkjr2ji8sYBfvg','https://www.youtube.com/channel/UC5-lOB3_zMkjr2ji8sYBfvg','サイエンス・ラボの公開講義。実験・観察を補う。')]
CH={x[0]:{'id':x[0],'name':x[1],'youtubeChannelId':x[2],'url':x[3],'description':x[4]} for x in channels}
cat={k:old[k] for k in ['schemaVersion','mathveoSourceCommit','subjects']};cat.update(updatedAt=STAMP,channels=list(CH.values()),units=[],series=[],videos=[],routes=[],chapterIndex=[],gaps=[])
V={};U={};S={};exclusions=[];duplicates=[];original_orders={}
BAD=re.compile(r'高校|大学受験|中[１２３123一二三]数学|中[１２３123一二三]年|中[１２３123]国語|中[１２３123]英語|漢文|古文基礎|伊勢物語|源氏物語|徒然草|枕草子|方丈記|共通テスト|月額|購入方法|オリエンテーション|動画すべて撮影|撮影しました|テキスト.*(?:紹介|案内)|チャンネル登録|サブスクリプション|投資|セミリタイア|お知らせ|ライブ|販売|予約|完全完成|増刷|先行|サンプル動画|会員限定|メンバー限定|中学[123一二三]年')
def add_unit(subject,field,name,url):
 key=(subject,field,name)
 if key not in U:
  uid=subject+'-'+slug('|'.join(key));U[key]={'id':uid,'subjectId':subject,'level':'中学受験','field':field,'name':name,'order':len(U),'path':[field],'classificationStatus':'title-supported','evidence':'公式講座名・単元目次・動画タイトルに基づく分類: '+url}
 return U[key]['id']

def clean(t,ch,field=''):
 t=re.sub(r'#[^\s#]+','',t).strip()
 if ch=='keitaku':
  m=re.search(r'(?:中学受験算数|計算達人)「(.+?)」',t)
  if m:return ('計算の工夫：' if '計算達人' in t else '')+m[1]
 if ch=='kobachan':
  t=re.sub(r'【(?:中学受験[^】]*|図形|基礎|永久保存版|毎日配信|最終回|ループ再生推奨)】','',t)
  t=t.replace('塾が泣く！元大手塾講師の本気授業！','')
 if ch=='sakurara':t=re.sub(r'【中学受験(?:算数|国語|理科|社会)?】','',t)
 if ch=='genius':return ('語彙：'+t) if len(t)<15 else t
 return t.strip() or field

# Conservative first-match topic classification. Unknown titles retain their official course heading.
RULES={
'mathematics':[
 ('数の性質','倍数・約数',r'倍数(?!算)|約数|素数|公倍|公約'),('数の性質','余り・整数条件',r'余り|あまり|整数条件|整数問題'),('数の性質','規則性・周期・数列',r'規則|周期|数列|階差|日暦|曜日|カレンダー|N進法|n進法'),
 ('文章題','つるかめ算',r'つるかめ|鶴亀'),('文章題','和差算・分配算',r'和差算|分配算'),('文章題','消去算',r'消去算'),('文章題','過不足算・差集め算',r'過不足|差集め'),('文章題','年齢算・倍数算',r'年齢|年令|倍数算'),('文章題','平均算',r'平均算|平均点'),('文章題','植木算・方陣算',r'植木算|方陣算'),('文章題','仕事算・ニュートン算',r'仕事算|ニュートン'),('整理と推理','条件整理・論理・推理',r'推理|論理|条件整理|うそつき'),('文章題','集合',r'集合|ベン図'),
 ('割合と比','食塩水',r'食塩|濃度|濃さ'),('割合と比','売買損益',r'売買|損益|定価|利益|割引|原価'),('割合と比','相当算・還元算',r'相当算|還元算'),('割合と比','割合・比',r'割合|百分率|比例|反比例|比の|比を|比①|比②|比③|比④'),
 ('速さ','時計算',r'時計|長針|短針'),('速さ','通過算・流水算',r'通過算|流水算|電車回廊|動く歩道'),('速さ','旅人算',r'旅人算|出会い|追いつ|追いかけ'),('速さ','ダイヤグラム',r'ダイヤグラム|速さ.*グラフ'),('速さ','速さの基本',r'速さ|歩幅|歩数'),
 ('立体図形','展開図・投影図',r'展開図|投影図'),('立体図形','切断',r'切断|切り口'),('立体図形','水量・容器',r'水量|水位|水そう|水槽|容器'),('立体図形','体積・表面積',r'体積|表面積|立方体|直方体|円すい|円錐|角すい|角錐|正八面体|正四面体|立体|空間図形'),
 ('平面図形','相似・面積比',r'相似|面積比|辺の比'),('平面図形','移動・回転・転がり',r'図形.*移動|回転|転が|ころが'),('平面図形','角度・図形の性質',r'角度|内角|外角|折り返|二等辺|正多角形|平行線'),('平面図形','面積・円・おうぎ形',r'面積|円周|おうぎ|扇形|円の|平面図形|正方形|長方形|三角形|四角形|台形|ひし形'),
 ('場合の数','場合の数',r'場合の数|組合せ|組み合わせ|順列|並べ|ならべ|道順|サイコロ'),('数と計算','計算の工夫・逆算',r'計算|逆算|分配法則|還元算'),('数と計算','整数・小数・分数',r'分数|小数|分母|分子|整数|四捨五入|概数')],
'chemistry':[
 ('生物','植物',r'植物|光合成|蒸散|種子|発芽|花の|花と|葉の|根・|根と|くき|茎|受粉'),('生物','動物・昆虫',r'動物|昆虫|メダカ|魚|カエル|アリ|チョウ|虫|節足'),('生物','人体',r'人体|消化|呼吸|血液|心臓|胎児|筋肉|骨|だ液|唾液|腎臓|ヒト'),('生物','季節・生態系',r'季節.*生物|生物.*季節|食物連鎖|生態系|生物のつながり'),
 ('地学','太陽・影',r'太陽|南中高度|透明半球|影の'),('地学','月',r'月の|月と|満ち欠け|上弦|下弦|新月|満月|月食'),('地学','星・星座・地球',r'星|星座|地球|天体|金星'),('地学','天気・気象',r'天気|気象|気温|気圧|湿度|雲|天候|台風|季節風'),('地学','大地・流水・岩石',r'大地|地層|岩石|火山|地震|流水|堆積|しゅう曲|断層|川の'),
 ('物理','電流・豆電球',r'電流|豆電球|回路|乾電池'),('物理','磁石・電磁石',r'磁石|磁界|磁力'),('物理','電熱線・発熱',r'電熱|発熱'),('物理','光',r'光の|光と|反射|屈折|凸レンズ|鏡'),('物理','音',r'^音|音の|音と|振動'),('物理','てこ・ばね',r'てこ|テコ|ばね|バネ|てんびん|天秤'),('物理','滑車・輪軸',r'滑車|輪軸'),('物理','浮力・圧力',r'浮力|圧力|水圧|密度'),('物理','運動・振り子',r'運動|振り子|ふりこ|おもりの動き'),
 ('化学','中和',r'中和'),('化学','水溶液・溶解度',r'水溶液|溶解|溶け|とけ|食塩水|酸性|アルカリ|リトマス'),('化学','気体',r'気体|酸素|二酸化炭素|水素|窒素|アンモニア|空気'),('化学','燃焼',r'燃焼|燃える|ろうそく|乾留'),('化学','状態変化・熱',r'状態変化|水蒸気|氷|熱|温度|カロリー|沸騰|蒸発|凝固'),('化学','実験器具・測定',r'実験器具|メスシリンダー|上皿|ガスバーナー|顕微鏡')],
'japanese':[
 ('文法','敬語',r'敬語|尊敬語|謙譲語|丁寧語'),('文法','助詞・助動詞',r'助詞|助動詞'),('文法','主語・述語・修飾語',r'主語|述語|修飾語|修飾関係'),('文法','品詞・活用',r'品詞|動詞|形容|連体詞|副詞|接続詞|感動詞|活用|名詞|文節|文法'),
 ('言葉の知識','慣用句',r'慣用句'),('言葉の知識','ことわざ・故事成語',r'ことわざ|諺|故事成語'),('言葉の知識','四字熟語',r'四字熟語'),('言葉の知識','漢字・部首・熟語',r'漢字|部首|書き順|熟語|音読み|訓読み'),('言葉の知識','同音異義語・同訓異字',r'同音|同訓'),('言葉の知識','語彙・類義語・対義語',r'語彙|類義語|対義語|外来語|擬音|擬態'),
 ('読解','記述・要約',r'記述|要約'),('読解','根拠・指示語・接続語',r'根拠|指示語|接続語|接続関係|なぜそういえる|理由を示す|逆接|対比'),('読解','選択肢問題',r'選択肢|選択問題'),('読解','説明文・論説文',r'説明文|論説文|論理的文章'),('読解','物語文・随筆',r'物語文|随筆'),('読解','詩・短歌・俳句',r'短歌|俳句|詩の|詩を')],
'japanese-history':[
 ('歴史','旧石器・縄文・弥生',r'旧石器|縄文|弥生|古代'),('歴史','古墳・飛鳥',r'古墳|飛鳥|大和|聖徳太子'),('歴史','奈良・平安',r'奈良|平安|遣唐使|藤原|平氏|平家'),('歴史','鎌倉',r'鎌倉|源頼朝|源実朝|執権|北条|元寇'),('歴史','室町・戦国',r'室町|足利|南北朝|戦国|応仁'),('歴史','安土桃山',r'安土|桃山|織田|豊臣|全国統一|本能寺'),('歴史','江戸',r'江戸|徳川|幕藩|参勤交代|鎖国|享保|寛政|天保|幕末'),('歴史','明治',r'明治|日清|日露|文明開化|富国強兵|自由民権'),('歴史','大正・昭和前期',r'大正|昭和|世界大戦|満州|満洲|太平洋戦争'),('歴史','戦後・現代',r'戦後|高度経済成長|冷戦|平成|令和|日本国憲法の制定'),('歴史','文化史・外交史',r'文化|外交|条約'),
 ('地理','農林水産業',r'農業|漁業|林業|水産|米づくり|畜産|野菜|果物|稲作'),('地理','工業・資源・エネルギー',r'工業|工場|資源|エネルギー|発電'),('地理','貿易・交通・情報',r'貿易|輸出|輸入|交通|運輸|情報'),('地理','人口・環境・災害',r'人口|環境|災害|公害|少子|高齢'),('地理','気候',r'気候|雨温図'),('地理','都道府県・地方',r'地方|都道府県|北海道|東北|関東|中部|近畿|中国四国|九州'),('地理','日本の国土・地形',r'国土|地形|山地|山脈|平野|盆地|海岸|川|河川|地図|地理'),
 ('公民','日本国憲法・人権・義務',r'憲法|人権|義務|基本原理'),('公民','国会・内閣・裁判所',r'国会|内閣|裁判|三権'),('公民','地方自治・選挙',r'地方自治|選挙'),('公民','財政・経済・社会保障',r'財政|経済|社会保障|税金|予算'),('公民','国際社会・国際連合',r'国際|国連|国際連合|国際紛争'),('公民','時事問題',r'時事')]
}
def classify(subject,title,fallback,unit=None):
 t=norm(title)
 if subject=='chemistry' and re.search(r'電流と発熱|電熱線',t):return '物理','電熱線・発熱'
 if subject=='chemistry' and re.search(r'磁界|電磁石',t):return '物理','磁石・電磁石'
 for f,u,pat in RULES[subject]:
  if re.search(pat,t):return f,u
 return fallback,unit or fallback

def series(sid,title,ch,subject,url,kind,level='中学受験'):
 if '偏差値60' in norm(title):level='応用・難関校対策'
 elif '標準・発展' in title:level='標準・発展'
 elif '基礎' in title:level='基礎'
 elif '1から学ぶ' in norm(title):level='基礎から（範囲は目次参照）'
 if sid not in S:S[sid]={'id':sid,'title':title,'channelId':ch,'subjectId':subject,'level':level,'sourceUrl':url,'sourceKind':kind,'orderBasis':'official-playlist' if kind=='playlist' else 'official-index','videoIds':[],'lessons':[],'coverage':'','notice':'講義映像・音声の品質と全授業の再生は未確認です。'+(' 地理統計・公民制度・時事の最新情報との照合は未完了です。' if subject=='japanese-history' else '')}
 return S[sid]

def add(entry,s,field,unit,sourceOrder):
 vid=entry['id'];title=entry['title'];ch=s['channelId'];subject=s['subjectId']
 if entry.get('restricted') or BAD.search(norm(title)):
  exclusions.append({'videoId':vid,'seriesId':s['id'],'sourceOrder':sourceOrder,'title':title,'reason':'授業以外の案内、または対象範囲外の表題'});return
 if not re.fullmatch(r'[\w-]{11}',vid) or not title or title in ['[Private video]','[Deleted video]','非公開動画','削除された動画']:
  exclusions.append({'videoId':vid,'seriesId':s['id'],'reason':'無効・非公開・表題未確認'});return
 if vid in s['videoIds']:
  duplicates.append({'videoId':vid,'seriesId':s['id'],'sourceOrder':sourceOrder});return
 if vid in V and V[vid]['subjectId']!=subject:
  exclusions.append({'videoId':vid,'seriesId':s['id'],'title':title,'reason':'異なる教科の再生リストへの混入（所属未確認）'});return
 uid=add_unit(subject,field,unit,s['sourceUrl']);duration=entry.get('durationSeconds')
 if vid not in V:
  V[vid]={'id':vid,'title':clean(entry.get('displayTitle') or title,ch,unit),'originalTitle':title,'channelId':ch,'youtubeChannelId':entry.get('channelId') or CH[ch]['youtubeChannelId'],'uploaderName':entry.get('uploader') or CH[ch]['name'],'subjectId':subject,'level':entry.get('level','中学受験（難易度未確認）'),'unitIds':[],'seriesIds':[],'order':len(V)+1,'role':entry.get('role') or ('advanced' if '偏差値60' in s['title'] else 'exam' if ch=='risukan' else 'core'),'sourceUrl':'https://www.youtube.com/watch?v='+vid,'verification':'verified','curriculum':'unverified','durationSeconds':duration,'thumbnailUrl':'https://i.ytimg.com/vi/'+vid+'/mqdefault.jpg','classificationEvidence':'公式目次・動画タイトルに基づく分類。講義映像の品質精査は未確認。出典: '+s['sourceUrl'],'availability':{'publicMetadata':'confirmed','embedMetadata':entry.get('embedMetadata','unverified'),'playback':'unverified','checkedAt':STAMP},'qualityReview':'unverified'}
 v=V[vid]
 if duration:
  if v['durationSeconds'] and v['durationSeconds']!=duration:raise ValueError('duration conflict '+vid)
  v['durationSeconds']=duration;v['durationEvidence']={'sourceUrl':entry.get('metadataSourceUrl',s['sourceUrl']),'method':entry.get('durationMethod','youtube-public-playlist'),'checkedAt':STAMP}
 if uid not in v['unitIds']:v['unitIds'].append(uid)
 v['seriesIds'].append(s['id']);s['videoIds'].append(vid);s['lessons'].append({'videoId':vid,'sourceOrder':sourceOrder,'unitId':uid})

# Playlists first: canonical YouTube titles, durations and owner IDs.
selected=read('selected-playlists.json')
for spec in selected:
 d=read('playlist-'+spec['id']+'.json');ch=d['channel'];subject=d['subject'];title=d['title'];pid=d['id']
 title=re.sub(r'テキスト(?:購入できます。.*|あります。.*|あり。.*|あり.*|有り.*|有.*)','',title).strip('。 ')
 s=series('yt-'+pid,title,ch,subject,d['url'],'playlist');s['listingComplete']=d['completeListing'];original_orders[s['id']]=[x['id'] for x in d['items']]
 if d.get('collectionError'):s['notice']+=' 取得途中で中断があり、講座の一部のみです。'
 for i,e in enumerate(d['items'],1):
  if e.get('channelId')!=CH[ch]['youtubeChannelId']:
   exclusions.append({'videoId':e['id'],'seriesId':s['id'],'sourceOrder':i,'title':e['title'],'reason':'投稿チャンネル不一致・未確認','actualChannelId':e.get('channelId')});continue
  fallback='読解総合' if subject=='japanese' else '算数総合' if subject=='mathematics' else '理科総合' if subject=='chemistry' else '社会総合'
  if subject=='japanese':
   if '語彙コント' in title:fallback='言葉の知識'
   elif '文法' in title:fallback='文法'
   elif '知識' in title:fallback='言葉の知識'
   else:fallback='読解'
  if ch=='lab':
   fallback='生物' if title in ['人体','動物','植物','昆虫','水中の生物','季節と生物'] else '地学' if title in ['天気','地球と大地の変化','大地の変化','太陽と気温と影','天体　星','天体　月'] else '化学' if title in ['物の溶け方','化学','燃焼','気体','熱','水と水蒸気と氷','実験器具の使い方','空気と水'] else '物理'
   field,unit=classify(subject,e['title'],fallback,title)
  else:
   if subject=='japanese-history':fallback='地理' if '地理' in title else '公民' if '公民' in title else '歴史' if '歴史' in title else '社会総合'
   field,unit=classify(subject,e['title'],fallback,'語彙・場面理解' if ch=='genius' and '語彙コント' in title else '記述・要約' if '記述' in title else '読解・作品別' if fallback=='読解' else title.strip('【】'))
  # Constrain ambiguous common words by the official course's field.
  if subject=='japanese-history' and fallback in ['地理','公民','歴史'] and field!=fallback:field,unit=fallback,title.strip('【】')
  e=dict(e)
  # Official school-level signs are retained; do not invent a difficulty ranking.
  e['level']='応用' if '偏差値60' in title or '発展' in title else '基礎' if '基礎' in title or '1から' in norm(title) else '中学受験（難易度未確認）'
  if ch=='lab':e['role']='reinforcement'
  add(e,s,field,unit,i)

# Official web indexes: omit inaccessible/unconfirmed oEmbed, no title guessing.
metadata=read('video-metadata.json');groups={}
for e in read('official-indexes.json')['items']:
 groups.setdefault((e['channel'],e['subject'],e['field']),[]).append(e)
for (ch,subject,field),entries in groups.items():
 sid=ch+'-'+subject+'-'+slug(field);url=entries[0]['sourceUrl'];s=series(sid,('中学受験算数' if subject=='mathematics' else '中学受験理科')+'：'+field,ch,subject,url,'official-index');s['listingComplete']=False
 original_orders[sid]=[x['id'] for x in entries]
 for i,e in enumerate(entries,1):
  meta=metadata.get(e['id'],{});author=meta.get('uploaderName')
  if meta.get('publicMetadata')!='confirmed' or (ch=='quick' and author!='クイックラーニング') or (ch=='risukan' and not author or ch=='risukan' and '理数館' not in author):
   exclusions.append({'videoId':e['id'],'seriesId':sid,'sourceOrder':i,'title':e['sourceTitle'],'reason':'YouTubeメタデータまたは投稿者を確認できない'});continue
  title=e['sourceTitle'] or meta['title'];u=e['unit'];f=field
  if ch=='risukan' and field=='比・割合':f='割合と比'
  if ch=='risukan' and field=='規則性':f='数の性質'
  if ch=='quick':
   f='数と計算' if field=='その他の領域' else '文章題' if field=='マルイチ算' else '立体図形' if field=='空間図形' else field
   if subject=='chemistry':
    f='生物' if field in ['植物','動物','人体'] else '地学' if field in ['大地の変化','天体','気象'] else '物理' if field in ['力学','電流','光と音'] else '化学' if field in ['水溶液','気体と燃焼','燃焼'] else '環境'
  # Keep the source subsection as primary, and append title-based topic tags.
  item={'id':e['id'],'title':meta['title'],'displayTitle':(e['unit']+'：' if ch=='risukan' and e['unit'] not in title else '')+title,'uploader':author,'channelId':CH[ch]['youtubeChannelId'],'embedMetadata':meta.get('embedMetadata','unverified')}
  if '応用' in title or '発展' in title:item['role']='advanced';item['level']='応用'
  elif '標準' in title:item['level']='標準'
  elif '基礎' in title or '基本' in title:item['level']='基礎'
  # Duration may already be supplied by an independently collected official playlist.
  add(item,s,f,u,i)
  if item['id'] in V:
   v=V[item['id']];f2,u2=classify(subject,title,f,u);uid=add_unit(subject,f2,u2,url)
   if uid not in v['unitIds']:v['unitIds'].append(uid)

# No official playlist was found for these supplementary lessons.
# Sequences follow creator lecture numbers; selection is explicitly editorial.
for spec in read('editorial-supplements.json'):
 s=series(spec['id'],spec['title']+'（独自構成）',spec['channel'],spec['subject'],spec['sourceUrl'],'editorial')
 s['orderBasis']='editorial';s['listingComplete']=False
 s['notice']='公式プレイリストの収録ではありません。確認できた講義番号に沿った独自構成で、一部のみ収録です。音声・全編再生は未確認。'
 original_orders[s['id']]=[x['id'] for x in spec['items']]
 for i,entry in enumerate(spec['items'],1):
  if entry.get('error') or entry.get('playerStatus')!='OK' or entry.get('channelId')!=CH[spec['channel']]['youtubeChannelId']:
   exclusions.append({'videoId':entry['id'],'seriesId':s['id'],'reason':'補強教材の公開メタデータ未確認'});continue
  field,unit=classify(spec['subject'],entry['title'],'読解','読み方の基礎')
  add(entry,s,field,unit,i)

# Metadata-only lists supplement durations without changing an index's order.
for path in sorted(D.glob('playlist-*.json')):
 d=json.loads(path.read_text());ch=d['channel']
 if ch not in ['quick','risukan']:continue
 for entry in d['items']:
  if ch=='quick' and entry.get('uploader')=='クイックラーニング' and entry.get('channelId'):
   CH[ch]['youtubeChannelId']=entry['channelId']
  v=V.get(entry['id'])
  if not v or v['channelId']!=ch or not entry.get('durationSeconds'):continue
  if ch=='risukan' and entry.get('channelId')!=CH[ch]['youtubeChannelId']:continue
  if ch=='quick' and entry.get('uploader')!='クイックラーニング':continue
  v['youtubeChannelId']=entry['channelId'];v['durationSeconds']=entry['durationSeconds'];v['durationEvidence']={'sourceUrl':d['url'],'method':'youtube-public-playlist','checkedAt':STAMP}

for v in V.values():
 if not v.get('youtubeChannelId') and v['channelId']=='quick':v['youtubeChannelId']=CH['quick']['youtubeChannelId']
for vid,evidence in read('watch-duration-evidence.json').items():
 if vid in V and evidence.get('durationSeconds') and evidence.get('channelId')==V[vid]['youtubeChannelId'] and evidence.get('videoId')==vid:
  V[vid]['durationSeconds']=evidence['durationSeconds'];V[vid]['durationEvidence']={k:evidence[k] for k in ['sourceUrl','method','checkedAt']}

for v in V.values():
 if not v.get('youtubeChannelId') and v['channelId']=='quick':v['youtubeChannelId']=CH['quick']['youtubeChannelId']

for sid,s in list(S.items()):
 if not s['videoIds']:del S[sid];continue
 excluded=sum(x.get('seriesId')==sid for x in exclusions);dups=sum(x['seriesId']==sid for x in duplicates)
 if s['sourceKind']=='editorial':s['coverage']=f"独自構成。公開メタデータを確認した{len(s['videoIds'])}授業。確認できた講義番号順で整理し、講座全体の完全収録は未確認。"
 elif s['sourceKind']=='playlist':s['coverage']=f"公式公開リストから{s['videoIds'].__len__()}授業。取得リスト内の対象外・投稿者不一致等を{excluded}件除外、重複参照{dups}件を統合。元の相対順を維持。削除・非公開項目の総数と講座全体の完結性は未確認。"
 else:s['coverage']=f"公式Web目次のリンクから{len(s['videoIds'])}授業を収録。リンクがない項目は収録せず、対象外・確認不能{excluded}件を除外。元の目次順を維持。公式講座全体の完全収録は未確認。"
 if s['channelId']=='kobachan' and '図形問題基礎講座' in s['title']:s['notice']+=' この公式リストは第50回から並んでいます。番号順を希望する場合は目次から第1回を選べます。'
 s['sourceCount']=len(original_orders[sid]);s['excludedCount']=excluded;s['duplicateCount']=dups

# Preserve legacy course URLs where the original selection is still verified.
ALIASES={'keitaku-math':('keitaku','mathematics'),'kobachan-science':('kobachan','chemistry'),'quick-science':('quick','chemistry'),'sakurara-japanese':('sakurara','japanese'),'sakurara-social':('sakurara','japanese-history')}
redirects={}
for sid,(ch,subject) in ALIASES.items():
 preferred={'keitaku-math':'1から学ぶ','kobachan-science':'中学受験理科','quick-science':'電流','sakurara-japanese':'国語知識','sakurara-social':'歴史第二期'}[sid]
 candidates=[s for s in S.values() if s['channelId']==ch and s['subjectId']==subject]
 target=next((s['id'] for s in candidates if preferred in norm(s['title'])),candidates[0]['id'] if candidates else None)
 if target:redirects[sid]=target
cat['legacySeriesRedirects']=redirects
channel_orders={'mathematics':['keitaku','risukan','quick','kobachan','sakurara','suiri'],'chemistry':['quick','kobachan','lab','sakurara'],'japanese':['sakurara','genius','doctor','kokugo','sugimoto'],'japanese-history':['sakurara']}
for subject in cat['subjects']:subject['channelOrder']=channel_orders[subject['id']]
# Collected titles and source headings determine coverage evidence, never a completeness claim.
cat['units']=list(U.values());cat['series']=list(S.values());cat['videos']=list(V.values())
# Editorial routes sequence courses but never change the ordering inside a source course.
for ch,subject,phrase in [('keitaku','mathematics','算数の基礎から'),('quick','chemistry','理科の単元講義'),('sakurara','japanese','国語の読解・知識'),('sakurara','japanese-history','社会の地理・歴史・公民')]:
 courses=[s for s in S.values() if s['channelId']==ch and s['subjectId']==subject and '偏差値60' not in s['title'] and '苦手' not in s['title']]
 if ch=='sakurara' and subject=='japanese-history':courses.sort(key=lambda x:next((i for i,k in enumerate(['社会地理','歴史第一期','歴史第二期','歴史第三期','社会公民']) if k in x['title']),9))
 if courses:cat['routes'].append({'id':ch+'-'+subject+'-route','title':phrase+'を進める','subjectIds':[subject],'description':'Curiveo Jr.独自の講座案内順です。各講座内は公式の順序を保ちます。','steps':[{'seriesId':s['id']} for s in courses]})
# Attach known publisher correction, exposed beside the lesson.
if 'RHoc0nnda4Q' in V:V['RHoc0nnda4Q']['title']='植物：種子の分類と発芽・成長の条件';V['RHoc0nnda4Q']['notice']='投稿者訂正：8:30の「有胚乳種子」は「無胚乳種子」の言い間違いです（投稿者コメントで確認）。'
# Explicit curriculum coverage is conservative and based on source labels only.
curriculum=json.loads((ROOT/'scripts/content/curriculum.json').read_text());coverage=[]
# Match terms are reviewed curriculum aliases; never infer unnamed genres of literature.
ALIASES_COVERAGE={
 '整数・小数・分数の計算':'整数|小数|分数|計算', '計算の工夫・逆算':'計算の工夫|計算達人|逆算', '概数・単位':'概数|単位',
 '倍数・約数・素数':'倍数|約数|素数', '余り・整数条件':'余り|あまり|整数条件', '規則性・周期・数列':'規則性|周期|数列',
 '比・比例と反比例':'比|比例|反比例', '割合・百分率':'割合|百分率', '道順・数え上げ':'道順|数え上げ', '順列・組合せ':'順列|組合せ|組み合わせ|並べ|ならべ', '整理と推理':'推理|論理|条件整理|うそつき',
 '植物・発芽・光合成':'植物|発芽|光合成', '花・実・植物分類':'花の|花と|花・|植物の分類', '人体・消化・呼吸・血液':'人体|消化|呼吸|血液', '季節・生態系':'季節.*生物|生態系|食物連鎖',
 '流水・地層・岩石':'流水|地層|岩石', '火山・地震':'火山|地震', '天気・気温・気圧':'天気|気温|気圧',
 '水の状態変化・熱':'状態変化|水蒸気|熱|氷', '実験器具・測定':'実験器具|測定|メスシリンダー|上皿',
 '語彙・類義語・対義語':'語彙|類義語|対義語', '詩・短歌・俳句':'詩の|詩を|短歌|俳句', '物語文・随筆':'物語文|随筆',
 '根拠・指示語・接続語':'根拠|指示語|接続語','説明文・論説文':'説明文|論説文',
 '都道府県・地方':'都道府県|地方', '農林水産業':'農業|林業|漁業|水産', '人口・環境・災害':'人口|環境|災害|公害',
 '戦後・現代':'戦後|高度経済成長|冷戦|平成|令和', '大正・昭和前期':'大正|昭和|世界大戦', '文化史・外交史':'文化|外交'
}
unit_by_id={u['id']:u for u in U.values()}
for subject,fields in curriculum.items():
 for field,topics in fields.items():
  for topic in topics:
   terms=ALIASES_COVERAGE.get(topic,'|'.join(re.escape(part) for part in topic.replace('・','|').split('|')))
   ids=[]
   for v in V.values():
    if v['subjectId']!=subject:continue
    matching=[unit_by_id[uid] for uid in v['unitIds'] if unit_by_id[uid]['field']==field]
    if not matching:continue
    hay=' '.join([norm(v['title']),*(norm(u['name']) for u in matching)])
    if re.search(terms,hay):ids.append(v['id'])
   coverage.append({'subjectId':subject,'field':field,'topic':topic,'videoIds':ids,'status':'listed' if ids else 'missing'})
cat['coverage']=coverage
for subject in cat['subjects']:
 missing=[r['topic'] for r in coverage if r['subjectId']==subject['id'] and r['status']=='missing']
 if missing:cat['gaps'].append({'subjectId':subject['id'],'reason':'教材対応を確認できていない項目：'+'、'.join(missing)})
 cat['gaps'].append({'subjectId':subject['id'],'reason':'全単元の基礎〜応用の到達点と、講義映像・音声の品質は精査未完了。'})
write('src/data/catalog.json',cat)
write('data/content/import-audit.json',{'checkedAt':STAMP,'videos':len(V),'courses':len(S),'sourceOrders':original_orders,'exclusions':exclusions,'duplicateReferences':duplicates,'legacySeriesRedirects':redirects})
print('Integrated',len(V),'videos',len(S),'courses',len(U),'units; exclusions',len(exclusions),'duplicates',len(duplicates))
print(collections.Counter(v['subjectId'] for v in V.values()))
