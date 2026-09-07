# SETUP.md — ローカル開発環境

## 必要要件

- Node.js 22 以上 / npm 10
- PostgreSQL 16（または Docker）
- Redis 7（任意。未設定時はインラインキューで動作）

## 1. 依存関係

```bash
cd global-sales-agent
npm install
```

## 2. 環境変数

```bash
cp .env.example .env
# 必須
#   DATABASE_URL     postgresql://gsa:gsa@localhost:5432/global_sales_agent?schema=public
#   AUTH_SECRET      openssl rand -base64 32
#   ENCRYPTION_KEY   openssl rand -base64 32   (32 bytes)
#   DEMO_MODE=true   外部AI・外部サービスなしで動作
# 任意
#   REDIS_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, AI_PROVIDER, AI_DEFAULT_MODEL, WEBHOOK_SIGNING_SECRET
```

PostgreSQL をローカルで用意する場合：

```bash
createuser gsa -P            # password: gsa
createdb global_sales_agent -O gsa
# or: docker compose up -d postgres redis
```

## 3. データベース

```bash
npm run db:generate          # Prisma Client
npm run db:migrate           # migrations (prisma migrate deploy)
npm run db:seed              # デモ組織 / ユーザー / 会社プロフィール / 100案件 / 既定ルール
```

Seed 後のログイン：

| ロール | メール | パスワード |
|---|---|---|
| ADMIN | admin@demo.local | Demo1234! |
| MANAGER | manager@demo.local | Demo1234! |
| SALES | sales@demo.local | Demo1234! |
| VIEWER | viewer@demo.local | Demo1234! |

## 4. 起動

```bash
npm run dev          # http://localhost:3000
npm run worker       # 別ターミナル（任意。REDIS_URL なしでもスケジューラとして動作）
```

`REDIS_URL` 未設定時、探索・解析・送信などのタスクは Web プロセス内で同期実行されます（デモ・テスト向け）。本番は Redis + Worker を推奨。

## 5. テスト

```bash
npm run test:unit            # 依存なし
npm run test:integration     # DB + Seed 必須（demo org を使用、pipeline データをリセットします）
npm run test:e2e             # Playwright（自動で build + start。E2E_NO_BUILD=1 で既存ビルド使用）
# 既存の Chromium を使う場合: PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

## 6. 実 AI を使う

`.env` に `ANTHROPIC_API_KEY` を設定し `DEMO_MODE=false`（または `AI_PROVIDER=anthropic`）にすると Analyst / Proposal / Reply / Negotiation / Closing / Translation / Compliance が実 AI で動作します。管理画面 → 設定 → AI で provider / model / temperature / 日次コスト上限を調整できます。

## 7. 実プラットフォームに接続する

設定 → プラットフォーム で認証情報を保存（AES-256-GCM で暗号化保存）。

- **Upwork**: OAuth2 の accessToken / orgId（提案送信は Upwork 承認済みアプリのみ。既定は MANUAL_APPROVAL）
- **Freelancer.com**: oauthToken / bidderId（公式 API で bid 送信可。既定は MANUAL_APPROVAL）
- **generic-api**: `config` に url / headers / itemsPath / mapping を JSON で指定
- **manual-import**: `POST /api/jobs/import`（CSV / JSON）または Jobs 画面の Import
- **coconala / crowdworks / lancers / peopleperhour**: 公開 API がなく自動投稿は規約で不可のため MANUAL_ONLY（提案候補生成 → 人間がコピーして送信 → 「送信済みにする」）

## トラブルシューティング

- `prisma migrate` で権限エラー → DB ユーザーに CREATE 権限を付与
- `ENCRYPTION_KEY must be 32 bytes` → `openssl rand -base64 32` の出力をそのまま設定
- ログインできない → `AUTH_SECRET` 設定後にサーバー再起動、Seed 済みか確認
