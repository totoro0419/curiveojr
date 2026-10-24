#!/usr/bin/env python3
"""Curiveo Jr. one-time bootstrap from upstream Curiveo (public)."""
from pathlib import Path
import json
import shutil
import re

ROOT = Path.cwd()
SOURCE = ROOT / "_upstream"
assert (SOURCE / "src/App.tsx").exists(), "Upstream checkout is missing"

for path in SOURCE.iterdir():
    if path.name in {".git", ".github", "data", "docs", "README.md"}:
        continue
    target = ROOT / path.name
    if path.is_dir():
        shutil.copytree(path, target, dirs_exist_ok=True)
    else:
        shutil.copy2(path, target)
shutil.copytree(SOURCE / ".github", ROOT / ".github", dirs_exist_ok=True)
# Remove files containing upstream-only bulk catalog and outdated evidence.
for filename in ("public/brand/curiveo-original.png", "public/brand/symbol.webp", "public/brand/wordmark.webp"):
    (ROOT / filename).unlink(missing_ok=True)

def replace(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise ValueError(f"{path}: missing expected text {old!r}")
    p.write_text(text.replace(old, new), encoding="utf-8")

# Independent app name, URLs, storage and worker cache space.
replace("vite.config.ts", 'base: "/curiveo/"', 'base: "/curiveojr/"')
replace("src/lib/pwa.ts", "'/curiveo/'", "'/curiveojr/'")
replace("src/lib/storage.ts", '"curiveo-learning"', '"curiveojr-learning"')
replace("src/navigation/route.ts", "curiveo:view:", "curiveojr:view:")
replace("src/lib/sync.ts", '"curiveo"', '"curiveojr"')
replace("scripts/build-sw.mjs", "curiveo-", "curiveojr-")
replace("scripts/build-sw.mjs", "__curiveo_cache_status__", "__curiveojr_cache_status__")
replace("scripts/build-sw.mjs", "Curiveoのオフライン", "Curiveo Jr.のオフライン")
replace("src/App.tsx", "github.com/totoro0419/curiveo", "github.com/totoro0419/curiveojr")
replace("src/App.tsx", "brand/symbol.webp", "brand/symbol.svg")
replace("src/App.tsx", "brand/wordmark.webp", "brand/wordmark.svg")
replace("src/App.tsx", 'alt="Curiveo"', 'alt="Curiveo Jr."')
replace("src/App.tsx", "YOUR LEARNING, CONNECTED", "YOUR JUNIOR LEARNING SPACE")

p = ROOT / "index.html"
s = p.read_text(encoding="utf-8")
s = s.replace("Curiveo — 学びを、つなぐ。", "Curiveo Jr. — 中学受験を、もっとわかりやすく。")
s = s.replace("#2563eb", "#e84b92").replace("Curiveoは学習", "Curiveo Jr.は中学受験の学習")
p.write_text(s, encoding="utf-8")

p = ROOT / "public/manifest.webmanifest"
manifest = json.loads(p.read_text())
manifest.update({"id": "/curiveojr/", "name": "Curiveo Jr. — 中学受験",
                 "short_name": "Curiveo Jr.", "start_url": "/curiveojr/",
                 "scope": "/curiveojr/", "background_color": "#fff8fc",
                 "theme_color": "#e84b92",
                 "description": "算数・国語・理科・社会を動画で学ぶ中学受験アプリ"})
p.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Use only pink highlights; leave readable neutral text colors unchanged.
p = ROOT / "src/styles.css"
s = p.read_text(encoding="utf-8")
colors = {
    "#2563eb": "#db2777", "#1d4ed8": "#be185d", "#3b82f6": "#ec4899",
    "#60a5fa": "#f472b6", "#93c5fd": "#f9a8d4", "#bfdbfe": "#fbcfe8",
    "#dbeafe": "#fce7f3", "#eff5ff": "#fff0f7", "#fafbfd": "#fff8fc",
    "#7ca7fc": "#f472b6", "#e6ebf2": "#f4dce8",
}
for old, new in colors.items():
    s = re.sub(re.escape(old), new, s, flags=re.IGNORECASE)
s = s.replace("--blue:", "--blue:")  # Preserve existing CSS variable API.
p.write_text(s, encoding="utf-8")

brand = ROOT / "public/brand"
brand.mkdir(parents=True, exist_ok=True)
(brand / "symbol.svg").write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ff86bb"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs><rect x="5" y="5" width="118" height="118" rx="35" fill="url(#g)"/><path d="M31 38c14-5 23-3 33 5 10-8 19-10 33-5v49c-14-4-24-1-33 6-9-7-19-10-33-6Z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="M64 44v48" stroke="#fff" stroke-width="6"/><path d="m54 54 22 12-22 12Z" fill="#fff"/></svg>''', encoding="utf-8")
(brand / "wordmark.svg").write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 84"><text x="4" y="52" font-size="53" font-weight="800" font-family="Arial,sans-serif" fill="#a91d60">Curiveo</text><text x="235" y="52" font-size="39" font-weight="800" font-family="Arial,sans-serif" fill="#e84b92">Jr.</text><text x="5" y="77" font-size="13" font-family="sans-serif" fill="#9b5876">JUNIOR LEARNING</text></svg>''', encoding="utf-8")

# Re-render install icons in the Jr. palette; never reuse the parent's app icon.
try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("Pillow is required for bootstrap icon generation")
for size, name in [(16,"favicon-16.png"), (32,"favicon-32.png"), (180,"icon-180.png"), (192,"icon-192.png"), (512,"icon-512.png"), (192,"icon-maskable-192.png"), (512,"icon-maskable-512.png")]:
    scale = 4
    sz = size * scale
    im = Image.new("RGBA", (sz, sz), (0,0,0,0))
    d = ImageDraw.Draw(im)
    pad = int(sz*0.06)
    d.rounded_rectangle((pad,pad,sz-pad,sz-pad), radius=int(sz*.28), fill="#e84b92")
    w = int(sz*.055)
    d.line([(sz*.25,sz*.35),(sz*.4,sz*.33),(sz*.5,sz*.40),(sz*.6,sz*.33),(sz*.75,sz*.35)], fill="white", width=w, joint="curve")
    d.line([(sz*.25,sz*.35),(sz*.25,sz*.68),(sz*.4,sz*.67),(sz*.5,sz*.72),(sz*.6,sz*.67),(sz*.75,sz*.68),(sz*.75,sz*.35)], fill="white", width=w, joint="curve")
    d.line([(sz*.5,sz*.40),(sz*.5,sz*.72)], fill="white", width=w)
    im.resize((size,size), Image.Resampling.LANCZOS).save(ROOT / "public" / name)

# School subject keys are retained as compatibility identifiers; visible labels are four subjects.
subjects = [
    {"id":"mathematics","name":"算数","shortName":"算数","description":"特殊算・割合・速さ・図形を学ぶ","icon":"Sigma"},
    {"id":"japanese","name":"国語","shortName":"国語","description":"読解・語彙・文法・ことわざを学ぶ","icon":"BookOpen"},
    {"id":"chemistry","name":"理科","shortName":"理科","description":"生物・地学・物理・化学を学ぶ","icon":"FlaskConical"},
    {"id":"japanese-history","name":"社会","shortName":"社会","description":"地理・歴史・公民を学ぶ","icon":"Landmark"},
]
channels = [
    {"id":"keitaku","name":"けいたくチャンネル","url":"https://www.youtube.com/@keitaku_kyoiku","description":"1から学ぶ中学受験算数"},
    {"id":"kobachan","name":"こばちゃん塾","url":"https://www.youtube.com/@katekyo-aspiration","description":"ゼロから始める中学受験理科"},
    {"id":"quick","name":"クイックラーニング","url":"https://www.youtube.com/@yama-da","description":"中学受験理科・算数の単元別授業"},
    {"id":"sakurara","name":"中学受験さくららチャンネル","url":"https://www.youtube.com/@sakurara","description":"国語の基礎講座、社会の歴史・地理など"},
]
course_specs = [
  ("keitaku-math","1から学ぶ中学受験算数・公開授業セレクション","keitaku","mathematics","基本〜応用"),
  ("kobachan-science","ゼロから始める中学受験理科・公開授業","kobachan","chemistry","基礎"),
  ("quick-science","中学受験理科・重要単元の解説","quick","chemistry","基礎〜標準"),
  ("sakurara-japanese","国語の知識・公開授業","sakurara","japanese","基礎"),
  ("sakurara-social","中学受験社会・歴史の公開授業","sakurara","japanese-history","基礎〜標準"),
]
# Video IDs / channel attribution checked against public YouTube pages or their public metadata.
# This is a carefully labeled starter selection, NOT a complete mirrored playlist.
entries = [
 ("zqyWhNG2nFE","消去算①（第22回）","keitaku-math","特殊算","消去算","core"),
 ("hcAi-yySVOQ","投影図（第43回）","keitaku-math","図形","立体図形","reinforcement"),
 ("hsOGYKpK1gc","相似①（第46回）","keitaku-math","図形","相似","reinforcement"),
 ("RHoc0nnda4Q","植物① 種子の分類と発芽条件","kobachan-science","生物","植物","core"),
 ("2MFWVU-kz4s","電流と発熱・例題2","quick-science","物理","電流","reinforcement"),
 ("qaiIOCWAnCI","電流によって生じる磁界・解説","quick-science","物理","電流","core"),
 ("bLlervaH6JE","国語知識・ことわざ①","sakurara-japanese","言葉の知識","ことわざ","core"),
 ("p0cUiSdsImI","室町時代③・足利義満と南北朝","sakurara-social","歴史","室町時代","reinforcement"),
 ("PlR6lH26yqU","全国統一②・織田信長の政治","sakurara-social","歴史","安土桃山時代","core"),
 ("JeJiofaDW2M","江戸時代・身分制度","sakurara-social","歴史","江戸時代","reinforcement"),
 ("p_a1mjvQ4Ec","明治時代①〜④・治外法権撤廃まで","sakurara-social","歴史","明治時代","reinforcement"),
]
course_by_id = {item[0]:item for item in course_specs}
units, unit_ids = [], {}
series = [{
  "id": sid, "title": title, "channelId": ch, "subjectId": subject, "level": "中学受験",
  "sourceUrl": next(c["url"] for c in channels if c["id"] == ch),
  "videoIds":[], "coverage":"公開動画の一部のみ収録。講座全体の網羅・動画内再生確認は未完了。",
} for sid,title,ch,subject,level in course_specs]
series_by_id = {s["id"]:s for s in series}
videos = []
for index, (ytid,title,sid,field,name,role) in enumerate(entries):
    course=course_by_id[sid]
    subject=course[3]
    unit_id=subject + "-" + re.sub(r"[^a-z0-9]", "", str(len(units)+1))
    key=(subject,field,name)
    if key not in unit_ids:
        unit_ids[key]=unit_id
        units.append({"id":unit_id,"subjectId":subject,"level":"中学受験","field":field,"name":name,"order":index,
                      "path":[field],"classificationStatus":"title-supported",
                      "evidence":"公開動画タイトルに基づく初期分類"})
    unit_id=unit_ids[key]
    series_by_id[sid]["videoIds"].append(ytid)
    videos.append({
      "id":ytid, "title":title, "channelId":course[2], "subjectId":subject,"level":"中学受験",
      "unitIds":[unit_id],"seriesIds":[sid],"order":index+1,"role":role,
      "sourceUrl":f"https://www.youtube.com/watch?v={ytid}",
      "verification":"verified","curriculum":"unverified","durationSeconds":None,
      "classificationEvidence":"公開された動画タイトルと投稿チャンネルを確認。埋め込み再生と授業内容の精査は未確認。",
      "availability":{"publicMetadata":"confirmed","embedMetadata":"unverified",
                      "playback":"unverified","checkedAt":"2026-10-24"}
    })
catalog = {
  "schemaVersion":1,"updatedAt":"2026-10-24","mathveoSourceCommit":"",
  "subjects":subjects,"channels":channels,"units":units,"series":series,"videos":videos,
  "routes":[],"chapterIndex":[],
  "gaps":[
     {"subjectId":"mathematics","reason":"けいたく・理数館・さんよび等の全講座の目次取得と網羅性検証が未完了"},
     {"subjectId":"japanese","reason":"国語読解の連続講座、0時間目のジーニアスの収録が未完了"},
     {"subjectId":"chemistry","reason":"こばちゃん塾・クイックラーニングの全単元と実験動画の収録が未完了"},
     {"subjectId":"japanese-history","reason":"さくららの地理・歴史・公民の全単元を順次追加する必要あり"}
  ]
}
(ROOT/"src/data/catalog.json").write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(ROOT/"src/data/video-durations.json").write_text("{}\n",encoding="utf-8")
(ROOT/"src/data/duration-status.json").write_text("{}\n",encoding="utf-8")
(ROOT/"src/data/history-duration-supplement.json").write_text("{}\n",encoding="utf-8")

# Remove the high-school-specific branching logic; use only catalog source units.
(ROOT/"src/navigation/hierarchy.ts").write_text('''import { catalog, seriesInSubject, videoMap, seriesMap } from "../catalog";
import type { Series, SubjectId, Video } from "../types";
export interface LearningNode {
 id:string;subjectId:SubjectId;parentId?:string;title:string;description:string;
 kind:"subject"|"level"|"field"|"unit"|"topic";children:string[];videoIds:string[];
 targets?:{videoId:string;startSeconds:number;title:string}[];evidence:string;sourceUnitIds:string[];
}
export const learningNodes=new Map<string,LearningNode>();
export const hierarchyRoots={} as Record<SubjectId,string>;
const videoLeaves=new Map<string,string[]>();
function add(id:string,subjectId:SubjectId,title:string,kind:LearningNode["kind"],parentId?:string):LearningNode{
 const result={id,subjectId,parentId,title,kind,description:title+"の授業を探す",children:[],videoIds:[],
 evidence:"公開動画の元単元名から作成した分類",sourceUnitIds:[]} as LearningNode;
 learningNodes.set(id,result);
 if(parentId)learningNodes.get(parentId)!.children.push(id);
 return result;
}
for(const subject of catalog.subjects){
 const rootId="subject-"+subject.id;hierarchyRoots[subject.id]=rootId;
 add(rootId,subject.id,subject.name,"subject");
}
const fieldIds=new Map<string,string>();
for(const unit of catalog.units){
 const fieldKey=unit.subjectId+":"+unit.field;
 let fieldId=fieldIds.get(fieldKey);
 if(!fieldId){fieldId="field-"+fieldKey;fieldIds.set(fieldKey,fieldId);
 add(fieldId,unit.subjectId,unit.field,"field",hierarchyRoots[unit.subjectId]);}
 const item=add("unit-"+unit.id,unit.subjectId,unit.name,"unit",fieldId);
 item.sourceUnitIds.push(unit.id);
}
for(const video of catalog.videos){
 for(const unitId of video.unitIds){
  const leaf=learningNodes.get("unit-"+unitId);if(!leaf)continue;
  const list=videoLeaves.get(video.id)||[];list.push(leaf.id);videoLeaves.set(video.id,list);
  for(let node:LearningNode|undefined=leaf;node;node=node.parentId?learningNodes.get(node.parentId):undefined){
    if(!node.videoIds.includes(video.id))node.videoIds.push(video.id);
    if(!node.sourceUnitIds.includes(unitId))node.sourceUnitIds.push(unitId);
  }
 }
}
for(const node of learningNodes.values()){
 node.videoIds.sort((a,b)=>catalog.videos.findIndex(v=>v.id===a)-catalog.videos.findIndex(v=>v.id===b));
 node.children.sort((a,b)=>{const left=learningNodes.get(a)!,right=learningNodes.get(b)!;
  const idx=(n:LearningNode)=>Math.min(...n.sourceUnitIds.map(id=>catalog.units.findIndex(u=>u.id===id)).filter(i=>i>=0));
  return idx(left)-idx(right);});
}
export function getNodePath(id:string){const arr:LearningNode[]=[];
 let node=learningNodes.get(id);while(node){arr.unshift(node);node=node.parentId?learningNodes.get(node.parentId):undefined;}return arr;}
export function nodeVideos(id:string):Video[]{return (learningNodes.get(id)?.videoIds||[]).flatMap(id=>{const v=videoMap.get(id);return v?[v]:[];});}
export function videoNodePath(videoId:string){return getNodePath(videoLeaves.get(videoId)?.[0]||"");}
export function nodeHref(node:LearningNode){return node.kind==="subject"?"#/subject/"+node.subjectId:"#/category/"+node.id;}
export function primarySeriesFor(node:LearningNode):Series|undefined{
 const candidates=catalog.series.filter(s=>seriesInSubject(s,node.subjectId)&&s.videoIds.some(id=>node.videoIds.includes(id)));
 return candidates.sort((a,b)=>b.videoIds.filter(id=>node.videoIds.includes(id)).length-a.videoIds.filter(id=>node.videoIds.includes(id)).length)[0];
}
''',encoding="utf-8")
(ROOT/"src/navigation/curriculum-order.ts").write_text('''import { catalog, videoMap } from "../catalog";
import type { Series, SubjectId } from "../types";
const roleRank={core:0,reinforcement:1,exam:2,advanced:3};
const levelOrder=["入門","基礎","基本","標準","応用","発展","中学受験"];
export function compareLevels(_subjectId:SubjectId,a:string,b:string){
 const rank=(x:string)=>{const i=levelOrder.findIndex(label=>x.includes(label));return i<0?levelOrder.length:i;};
 return rank(a)-rank(b);
}
export function compareCategory(_subjectId:SubjectId,_parent:string,a:string,b:string){
 return a.localeCompare(b,"ja");
}
export function sortCourses(courses:Series[]):Series[]{
 return [...courses].sort((a,b)=>{
  const ai=catalog.subjects.findIndex(s=>s.id===a.subjectId);
  const bi=catalog.subjects.findIndex(s=>s.id===b.subjectId);
  const role=(s:Series)=>Math.min(9,...s.videoIds.map(id=>roleRank[videoMap.get(id)!.role]));
  return ai-bi||compareLevels(a.subjectId,a.level,b.level)||role(a)-role(b)||
  catalog.series.findIndex(s=>s.id===a.id)-catalog.series.findIndex(s=>s.id===b.id);
 });
}
''',encoding="utf-8")
(ROOT/"src/navigation/course-outline.ts").write_text('''import { unitMap, videoMap } from "../catalog";
import type { Series } from "../types";
export interface CourseChapter {id:string;title:string;videoIds:string[];}
export function courseOutline(series:Series):CourseChapter[]{
 const chunks:CourseChapter[]=[];
 for(const id of series.videoIds){
  const unit=videoMap.get(id)?.unitIds.map(uid=>unitMap.get(uid)).find(Boolean);
  const title=unit?.name||"授業一覧";
  const last=chunks[chunks.length-1];
  if(last?.title===title)last.videoIds.push(id);
  else chunks.push({id:series.id+"-chapter-"+chunks.length,title,videoIds:[id]});
 }
 return chunks;
}
''',encoding="utf-8")

# Keep original dependencies/lockfile. Use compatible build checks for the new dataset.
p=ROOT/"package.json"
package=json.loads(p.read_text(encoding="utf-8"))
package["name"]="curiveojr"
package["scripts"]["build"]="tsc --noEmit && node scripts/validate-catalog.mjs && vite build && node scripts/build-sw.mjs"
package["scripts"]["test:jr"]="node scripts/validate-catalog.mjs"
p.write_text(json.dumps(package,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
lock=ROOT/"package-lock.json"
meta=json.loads(lock.read_text(encoding="utf-8"));meta["name"]="curiveojr";meta["packages"][""]["name"]="curiveojr"
lock.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
# Avoid including upstream audit/gap documents. The source repository remains unchanged.
readme='''# Curiveo Jr.

中学受験4教科の動画学習アプリ。既存Curiveoから学習記録・プレイリスト・YouTube再生・PWAの仕組みを継承し、別アプリとして構築。

**公開予定:** https://totoro0419.github.io/curiveojr/

## 初期収録（2026-10-24）
算数「けいたく」3本、理科「こばちゃん塾」1本、「クイックラーニング」2本、
国語「中学受験さくららチャンネル」1本、社会「中学受験さくららチャンネル」4本。
合計 **11本 / 5講座 / 4チャンネル**。全講座の完成版ではありません。
動画IDと公開タイトルは公開ページで確認。各動画の埋め込み可否・再生時間・学習指導要領対応は未検証。
動画の権利はそれぞれの投稿者に帰属します。動画データの複製・ダウンロードはしていません。

## デザインと仕様
ピンク基調の独立したアイコンとロゴ。4教科→チャンネル→講座→授業。
元Curiveoの進捗・メモ・履歴・お気に入り・後で見る・学習再開・PWA更新・オフラインシェルを流用。
元のアプリとの学習記録・ブラウザキャッシュは別管理です。
Googleログイン同期は新規Firebase設定後のみ有効になります。元アプリの接続設定を流用しません。

## 今後の拡充
- 算数: けいたく全講義順を確認、理数館、さんよび
- 国語: さくらら読解連続講義、0時間目のジーニアス
- 理科: こばちゃん塾・クイックラーニングの全講座、実験動画
- 社会: さくららの地理・歴史・公民を順番に収録
誤った授業順を創作しないため、断片収録はセレクションとして表記しています。

## 開発
\`npm ci\`
\`npm run build\`
\`npm run dev\`

カタログ: \`src/data/catalog.json\`
GitHub Pages: \`main\` push時にActionsビルド/公開。
アップストリーム: https://github.com/totoro0419/curiveo
'''
(ROOT/"README.md").write_text(readme,encoding="utf-8")
# Names on workflows must be identifiable for operations.
pages=ROOT/".github/workflows/pages.yml"
pages.write_text(pages.read_text(encoding="utf-8").replace("Deploy Curiveo to GitHub Pages","Deploy Curiveo Jr. to GitHub Pages").replace("group: curiveo-pages","group: curiveojr-pages"),encoding="utf-8")
# Remove scratch checkout before staging target.
shutil.rmtree(SOURCE)
print("Curiveo Jr. bootstrap finished; starter videos:",len(videos))
