# DEPLOYMENT.md — 本番デプロイ

## 構成

```
[Browser] → [Next.js web (standalone)] → PostgreSQL
                     │                     ▲
                     └── Redis (BullMQ) ──> [worker]  (discovery / analysis / sending / reply polling / scheduler)
```

## ワンクリック（Render Blueprint）

リポジトリ直下の `global-sales-agent/render.yaml` を Render の Blueprint として読み込むと、Postgres / Key Value / Web / Worker が作成され、`prisma migrate deploy` と Seed が起動時に実行されます。`ENCRYPTION_KEY` は Render が生成する任意長のランダム値でも動作します（32 bytes base64 でない場合は SHA-256 で鍵導出）。

## Vercel Cron（Worker を置けない場合）

`vercel.json` の `crons` が `GET /api/cron/tick` を 30 分ごとに呼び出します。`CRON_SECRET` を環境変数に設定してください（Vercel が `Authorization: Bearer` で送信）。外部 cron から呼ぶ場合も同じヘッダーを付けます。

## Docker Compose（単一ホスト）

```bash
cp .env.example .env
# 本番値: NODE_ENV=production, DEMO_MODE=false, AUTH_SECRET, ENCRYPTION_KEY, APP_URL=https://your-domain,
#         ANTHROPIC_API_KEY or OPENAI_API_KEY, WEBHOOK_SIGNING_SECRET
docker compose up -d --build
```

- `migrate` サービスが `prisma migrate deploy` と seed を実行します。本番で seed を実行したくない場合は `command` を `npx prisma migrate deploy` のみに変更してください。
- TLS 終端は前段のリバースプロキシ（Caddy / nginx / ALB）で行い、`X-Forwarded-Host` を渡してください（`AUTH_TRUST_HOST=true`）。

## Vercel + Managed Postgres + Managed Redis

1. `global-sales-agent` を Root Directory に設定。Build Command: `npm run build`、Install: `npm install`。
2. 環境変数を設定（上記 .env と同じ）。`DATABASE_URL` は接続プール（PgBouncer / Neon pooled）推奨。
3. Worker は Vercel では動作しないため、Fly.io / Railway / ECS などで `npm run worker` を常駐させるか、`Trigger.dev` などのジョブ基盤へ `src/lib/queue/handlers.ts` の `runTask` を移植してください。
4. `next.config.ts` の `output: "standalone"` は Vercel でも問題ありません。

## 環境変数一覧

| 変数 | 必須 | 説明 |
|---|---|---|
| DATABASE_URL | ✔ | PostgreSQL |
| AUTH_SECRET | ✔ | Auth.js セッション署名 |
| ENCRYPTION_KEY | ✔ | 32 bytes base64（プラットフォーム認証情報の暗号化） |
| APP_URL | ✔ | 公開 URL |
| REDIS_URL | 推奨 | BullMQ / レート制限 |
| DEMO_MODE | | `true` で Mock AI + デモ連携 |
| ANTHROPIC_API_KEY / OPENAI_API_KEY | 実AI時 | AI Provider |
| AI_PROVIDER / AI_DEFAULT_MODEL | | 既定プロバイダ / モデル |
| AI_PRICING_JSON | | モデル料金表の上書き `{"model":{"input":$,"output":$}}` |
| WEBHOOK_SIGNING_SECRET | Webhook時 | `/api/webhooks/[platform]` の HMAC 検証 |
| DISCOVERY_INTERVAL_MINUTES / REPLY_POLL_INTERVAL_MINUTES | | Worker スケジュール |
| WORKER_CONCURRENCY | | BullMQ 並列数 |
| NEXT_OUTPUT_STANDALONE | Docker | `1` で `output: "standalone"` ビルド（Dockerfile が設定。通常の `next start` 運用では未設定） |

## マイグレーション

```bash
npx prisma migrate deploy
```

スキーマ変更時は開発環境で `npx prisma migrate dev --name <change>` を実行し、生成された `prisma/migrations/*` をコミットしてください。

## セキュリティチェックリスト

- [ ] `AUTH_SECRET` / `ENCRYPTION_KEY` をシークレットマネージャで管理
- [ ] HTTPS 必須（Cookie は `secure`）
- [ ] `DEMO_MODE=false`（`/api/demo/reset` が無効化される）
- [ ] DB のバックアップ（毎日）と `audit_logs` の保持期間ポリシー
- [ ] AI 日次コスト上限（設定 → AI）とプランの上限
- [ ] Webhook を公開する場合は `WEBHOOK_SIGNING_SECRET` を設定

## 監視

- `GET /api/health` … DB / queue mode / demo flag
- Worker ログ（`[worker]`, `[scheduler]`）
- `audit_logs` / `ai_runs` テーブルで AI 判断・コストを追跡
