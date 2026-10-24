# Curiveo Jr.

ピンク基調の中学受験4教科動画学習アプリ。元 Curiveo から独立したリポジトリ・PWA・学習記録を使用します。

公開先: https://totoro0419.github.io/curiveojr/

2026-10-24収録：6,849本・98講座・11チャンネル。動画IDは一意、公式リスト・目次の相対順を保持。原題・投稿者・時間の確認元・除外理由を保存しています。

**全講義の実再生・映像音声品質・基礎から応用までの到達点は未確認です。** 国語の説明文・論説文は教材対応を確認できていません。完全収録・全科目合格とは表示していません。

詳しい講座一覧・単元カバレッジ・採用理由・制限は [収録報告](docs/content/CONTENT_REPORT.md) を参照してください。

## 開発と検査

```sh
npm ci
npm run content:integrate  # ネットワーク不要。保存済みの一次資料から再生成
npm run test:content
npm run build
npm run dev -- --host 127.0.0.1
```

`src/data/catalog.json` に完全な出典情報を保持します。アプリは `scripts/build-catalog-runtime.mjs` が生成する約1.3MBのコンパクトな索引を読み込みます。

公開教材の追加調査は `scripts/content/collect.py` と `verify.py` を使用します（Python、beautifulsoup4）。取得は明示実行し、HTTP 429では停止します。取得結果を確認してから統合してください。通常ビルドは外部サービスの取得成功に依存しません。

GitHub Pagesは `main` push時に、検査・本番ビルド後に公開します。
