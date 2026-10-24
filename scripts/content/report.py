#!/usr/bin/env python3
from pathlib import Path
import json,collections
ROOT=Path(__file__).resolve().parents[2]
c=json.loads((ROOT/'src/data/catalog.json').read_text());audit=json.loads((ROOT/'data/content/import-audit.json').read_text());out=ROOT/'docs/content';out.mkdir(parents=True,exist_ok=True)
by={v['id']:v for v in c['videos']};chn={x['id']:x['name'] for x in c['channels']};sn={x['id']:x['name'] for x in c['subjects']}
lines=['# Curiveo Jr. コンテンツ収録・検証報告','', '確認日：2026-10-24。元 Curiveo は変更していません。Jr. の既存11本はIDを維持しています。','',
 '**実装・データ検査と講義品質の確認は別です。** 公開目次・動画メタデータから収録しました。全動画の実再生、音声・説明の分かりやすさ、全単元の到達点、実機の網羅的確認は未完了です。「完全収録」「全分野が基礎から応用まで合格」とは判定していません。','',
 '## 教科別集計','', '| 教科 | 一意の動画 | 講座 | チャンネル | 時間取得 |','|---|---:|---:|---:|---:|']
for sub in c['subjects']:
 vs=[v for v in c['videos'] if v['subjectId']==sub['id']];ss=[s for s in c['series'] if s['subjectId']==sub['id']];lines.append(f"| {sub['name']} | {len(vs):,} | {len(ss)} | {len(set(v['channelId'] for v in vs))} | {sum(bool(v['durationSeconds']) for v in vs):,} |")
lines+=['',f"合計：{len(by):,}本／{len(c['series'])}講座／{len(c['channels'])}チャンネル。動画IDが同じ参照は学習記録を共有します。",'',
 '## 採用理由と主軸','', '| チャンネル | 役割・採用根拠（一次資料） | 品質確認の限界 |','|---|---|---|']
reasons={
 'keitaku':'算数の基礎の案内軸。「1から学ぶ」の公式コースと計算・特殊算の公式リストを取得。',
 'risukan':'算数の体系・単元補強。公式Web目次に単元、小テーマ、難易度表示がある。',
 'kobachan':'算数の図形・特殊算、理科の連続授業を補強。公式リストを使用。',
 'quick':'算数・理科の体系の案内軸。公式目次が基礎・標準・応用を区別し、理科4分野と計算を扱う。',
 'sakurara':'社会の主軸を維持。地理・歴史3期・公民、国語の読解・知識・文法・記述、算数・理科の公開リストを取得。',
 'genius':'国語の語彙を場面と結びつける補強。公式の語彙コントと記述添削リストを使用。',
 'lab':'理科の実験・観察の補強候補。公式の分野別公開リストを使用。有料サービス全体の収録ではない。',
 'doctor':'物語文・随筆の読み方と心情記述を補強。公式公開リストの5本。',
 'suiri':'条件整理・集合・推理を補強。中学受験専用リストを使用し、混入した中2数学は除外。',
 'kokugo':'指示語、対比、理由、心情記述を補強。公式チャンネルの講義番号から独自構成。',
 'sugimoto':'選択肢問題の手順を補強。公開動画の本人メタデータを確認。独自セレクション。'}
for ch in c['channels']:lines.append(f"| [{ch['name']}]({ch['url']}) | {reasons[ch['id']]} | 公開目次・タイトルは確認。講義の音声・全編映像の品質評価は未確認。 |")
lines+=['','「最適な主軸」の最終評価は未完了です。上記の主軸は、確認できた公開範囲・体系性に基づく案内上の選定であり、未視聴の授業を品質合格と判定していません。','',
 '### 比較したその他の候補','',
 '| 候補 | 調査内容と今回の判断 |','|---|---|',
 '| さんよび | [公式サイト](https://sanyobi.online/)で思考・図解重視の方針と公式チャンネルを確認。講座全体の目次・代表授業の実視聴は未確認のため今回は未収録。 |',
 '| まなびスクエア | [公式チャンネル](https://www.youtube.com/@manavisquare)の中学受験図形動画を確認。算数の演習は既採用講座が広範囲に存在し、網羅的・品質比較を終えていないため今回は未収録。 |',
 '| 中学受験のrestart | [公式リスト](https://restart.tniida.com/?page_id=145)と公式チャンネルの公開リストを確認。理科の補強候補だが代表授業の品質確認は未完了のため今回は未収録。 |',
 '| アテナチャンネル | [季節の星座の公式動画](https://www.youtube.com/watch?v=KvSzqPfUeoM)と説明欄の関連講座を調査。映像の品質確認が未完了のため今回は未収録。 |',
 '', '候補発見には[がくすけブログ](https://smart-edu.tokyo/osusume-hikaku/best-youtube-exam-prep/)、[双子の中学受験](https://www.twins-exam.com/chugaku-youtube/)、[中学受験の下書き](https://www.jukenlab.net/entry/G-labo)、[紹介記事](https://note.com/rioitsuki/n/n45ee759baa12)も使用。採用動画のID・タイトル・投稿者・順序は公式YouTubeまたは投稿者の公式目次で確認。','',
 '## 講座一覧・収録範囲','',
 '「取得完了」は閲覧できた公開リストの継続ページを最後まで取得した意味です。非公開・削除・有料項目を含めた講座全体の完結性を意味しません。投稿者の公式リストが逆順でも、リスト自体の順番は変更していません。','',
 '| 教科 | チャンネル | 講座・出典 | 収録本数 | 構成 |','|---|---|---|---:|---|']
for s in c['series']:
 label={'playlist':'公式公開リスト順','official-index':'公式Web目次順','editorial':'独自構成・一部収録'}[s['sourceKind']]
 lines.append(f"| {sn[s['subjectId']]} | {chn[s['channelId']]} | [{s['title'].replace('|','／')}]({s['sourceUrl']}) | {len(s['videoIds'])} | {label} |")
lines+=['','## 単元カバレッジ','',
 '下表は公式単元名・タイトルの対応を示します。「教材あり」は該当分野を扱う動画を確認したという意味で、基礎・標準・応用すべての到達点の網羅性を証明しません。本文が作品名だけの読解動画は、説明文などの文章種別を推測していません。','',
 '| 教科 | 分野 | 単元 | 対応動画 |','|---|---|---|---:|']
for r in c['coverage']:lines.append(f"| {sn[r['subjectId']]} | {r['field']} | {r['topic']} | {len(r['videoIds']) if r['videoIds'] else '教材対応未確認'} |")
lines+=['','### 不足・未確認','']
for g in c['gaps']:lines.append(f"- {sn[g['subjectId']]}：{g['reason']}")
lines+=['- 国語の説明文・論説文は教材対応未確認。追加候補として伸学会の論説文学習法（l_FM-7W1w2Q）の投稿者・時間・説明欄は確認したが、保護者向け学習法の説明であり、児童が順に受講する読解講座としての適合性と授業品質を確認できていないため未収録。',
 '- 公民制度、地理統計、時事動画の最新入試情報との照合は未完了。',
 '- 国語を得意にする「考え方」は第3回が学習法のため今回の授業選定から除外し、欠番を無理に埋めていない。','',
 '## データの正確性・順序検査','',
 f"- 一意の動画ID：{len(by):,}。同一IDの重複登録なし。講座内重複参照は{len(audit['duplicateReferences'])}件統合。",
 f"- 対象外の案内・広告・投稿者不一致・別教科など{len(audit['exclusions'])}件を除外。ID・理由・元の位置は `data/content/import-audit.json` に保存。",
 '- 公式リスト・目次の元ID配列と sourceOrder を比較。授業の欠落を創作で補わず、除外後も元の相対順を維持。講座別 unitId を保持し、同じ動画の複数講座参照で目次が混ざらない。',
 '- 原題・アプリ内タイトル・投稿者・チャンネルID・出典・時間の出典・検証日を `src/data/catalog.json` に保存。収録判定の根拠は `data/content/` に保存。',
 '- 時間は公式公開リストに示された値を基本とし、不足分は同じ動画ID・投稿者IDの視聴ページメタデータで補完。推定値なし。未取得を0分として扱わない既存処理も維持。',
 '- こばちゃん塾の植物第1回について、投稿者が8:30の「有胚乳種子」を「無胚乳種子」へ訂正しているコメントを確認。再生画面に訂正を表示。','',
 '## 実装内容','',
 '- `scripts/content/collect.py`, `verify.py`, `integrate.py`, `curriculum.json`：公開教材の取得、投稿者確認、重複管理、単元表・再現可能な統合。',
 '- `src/data/catalog.json`：原題・根拠を含む完全な収録データ。`catalog-runtime.json`：同じ学習内容の起動用圧縮データ。',
 '- `scripts/build-catalog-runtime.mjs`, `src/catalog.ts`：圧縮データを展開し、全動画・順序・学習記録用IDを保持。',
 '- `src/navigation/course-outline.ts`：講座別の単元参照を使用。`hierarchy.ts`：大量動画でも線形検索を繰り返さないよう索引化。',
 '- `src/pages/HierarchyPage.tsx`：教科別の収録状況、公式目次順と独自構成の区別、社会の「単元から探す」表示。',
 '- `src/App.tsx`：投稿者の訂正を授業画面に表示。',
 '- `src/lib/duration.ts`：取得元を確認できた時間を合計・残り時間に使用。',
 '- `scripts/validate-content.mjs`：全動画の参照・原題・投稿者・時間根拠・原順序・目次・再生リスト・算術を検査。',
 '- `.github/workflows/pages.yml`：公開前にコンテンツと主要回帰検査を実行。',
 '- 学習記録のストレージ、動画ID、再生コンポーネント、同期、ピンクの既存デザイン、PWAの更新方式は維持。',
 '', '## 検証・公開','',
 '実行結果は [検証ログ](validation.txt) と [公開後の確認記録](runtime-qa.md) を参照。',
 '', '公開先： https://totoro0419.github.io/curiveojr/','']
(out/'CONTENT_REPORT.md').write_text('\n'.join(lines))
print('report created')
