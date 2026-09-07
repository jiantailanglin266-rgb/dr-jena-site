# GLOBAL SALES AGENT — Multilingual AI Sales & Deal Automation Platform

> 世界中のスキルマーケット／フリーランスマーケットプレイス（ココナラ・クラウドワークス・ランサーズ・Upwork・Freelancer・PeoplePerHour …）を対象にした
> **案件発見 → AI解析 → 適合判定 → 提案文自動生成 → 承認送信 → 返信解析 → AI返信 → 価格交渉 → 受注可能性スコアリング → 商談支援 → 受注 → CRM** を一元管理する AI Sales Agent Platform。
> 管理画面からシステム名を変更可能（既定：GLOBAL SALES AGENT / 別名：AI DEAL CLOSER）。

本アプリは Dr.Jena コーポレートサイト（リポジトリ直下の静的サイト）とは独立した `global-sales-agent/` サブプロジェクトです。既存サイトには変更を加えていません。

## ハイライト

| 領域 | 内容 |
|---|---|
| Discovery Engine | Platform Connector Architecture（`src/lib/connectors/*`）。demo-marketplace / upwork / freelancer / generic-api / manual-import + 規約上 手動のみの coconala / crowdworks / lancers / peopleperhour |
| AI Analysis | Analyst Agent → JSON解析 + Fit / Profit / Client Quality / Win Probability / Urgency / Risk → **Opportunity Score**（閾値未満は自動除外） |
| Proposal | 10構造の完全個別化提案、SHORT/STANDARD/DETAILED × 6トーン、**Client Language Detection + Language Layer**（`proposalOriginal` / `proposalTranslated` / `detectedLanguage`）、Performance Memory を反映、A/B variant |
| Send Engine | Proposal Queue（DRAFT→…→SENT）、AUTO / MANUAL_APPROVAL / MANUAL_ONLY、Daily / Hourly / Client 接触制限、重複送信禁止、Compliance Agent、営業時間 |
| Reply Intelligence | 11分類 + sentiment / intent / purchase_probability / urgency / next_best_action。**Thread Memory** でスレッド全体を理解 |
| Negotiation | Pricing Engine（minimumPrice / targetPrice / idealPrice / maximumDiscount / hourlyRate）。**AI は minimumPrice 以下に下げられない**。通常/割引/スコープ縮小/分割納品/オプション/保守契約。価格確定前の Human Approval |
| Closing | Deal Summary（価格・納期・業務内容・成果物・修正回数・支払・IP・保守・契約方法）。**WON は人間承認のみ** |
| CRM | Companies / Contacts / Opportunities（Kanban 12ステージ）/ Conversations / Proposals / Quotes / Deals / Tasks / Activities |
| Automation | No-code Rule Builder（IF fitScore > 85 AND budget > 1000 … THEN Create Proposal / IF reply = PRICE_NEGOTIATION THEN Negotiate …）、dry-run、実行ログ |
| Analytics | KPI、AI Sales Funnel、Platform / Country / Language / Category 別、A/B、Performance Memory、AI Cost（Daily / Monthly / per Lead / Proposal / Reply / Won） |
| Safety | CAPTCHA回避・不正ログイン・レート制限回避・身元偽装・虚偽実績・無制限送信を**実装しない**。Audit Log（誰が/いつ/どのAIが/どんな判断で/何を送ったか） |
| Multi-tenant SaaS | organizations / memberships / RBAC（ADMIN / MANAGER / SALES / VIEWER）/ STARTER・PRO・BUSINESS・ENTERPRISE プラン制限 / テナント分離 |
| Demo Mode | 外部AIキー・外部アカウント不要。Fake Marketplace API + 100件の架空案件（9カ国・10カテゴリ）+ 返信シミュレータで 発見→提案→返信→交渉→受注 を完走 |

## クイックスタート（Demo Mode）

```bash
cd global-sales-agent
cp .env.example .env            # ENCRYPTION_KEY / AUTH_SECRET を openssl rand -base64 32 で設定
docker compose up --build       # postgres + redis + migrate/seed + web + worker
# → http://localhost:3000  ログイン: admin@demo.local / Demo1234!
```

ローカル（Docker なし）: [SETUP.md](./SETUP.md)。本番: [DEPLOYMENT.md](./DEPLOYMENT.md)。API: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)。

## デモの流れ

1. **Dashboard → 「案件を探索」**：demo-marketplace から100件を取得（Seed 済みの場合は重複判定）→ Analyst Agent が解析 → Opportunity Score → 自動化ルールで高適合案件に提案生成。
2. **Jobs**：案件ごとにスコア・リスク・推奨アクション。「Create proposal」で長さ・トーン・言語を選び生成。クライアント言語（日/英/独/仏/西/韓…）で提案文が生成され、自社言語の原文も保持。
3. **Proposals**：承認待ちを承認 → Send Engine（Compliance・制限チェック）→ demo-marketplace に送信。MANUAL_ONLY プラットフォーム（ココナラ等）は提案をコピーして人間が送信し「送信済みにする」。
4. **Dashboard → 「返信を同期」**：架空クライアントがペルソナに従い返信（興味 / 質問 / 価格交渉 / 会議依頼 / 承諾 / 拒否）。Reply Agent が分類し、AI返信案を作成（承認待ち）。
5. **Conversations**：スレッド全体を見ながら返信案を編集・承認送信。価格交渉では Pricing Engine が floor を守った見積を作成（価格変更は人間承認）。
6. **承諾 → Deal Summary**：Closing Agent が 9項目をまとめ、人間がチェックリストを確認して **WON** に確定 → CRM（Company / Contact / Deal / Task）へ登録。
7. **Analytics / Costs / Audit** で成果・AIコスト・全判断履歴を確認。

## ディレクトリ

```
docs/        設計ドキュメント（SYSTEM_ARCHITECTURE, DATABASE_SCHEMA, AI_AGENT_ARCHITECTURE, PLATFORM_CONNECTOR_SPEC, AUTOMATION_ENGINE, SECURITY, IMPLEMENTATION_PLAN, UI_SPEC）
prisma/      schema.prisma / migrations / seed.ts
src/app/     App Router（(auth)/login, (app)/…, api/…）
src/lib/     ai / agents / connectors / automation / pricing / scoring / language / sending / queue / services
src/worker/  BullMQ worker + scheduler
tests/       unit / integration (Vitest) / e2e (Playwright)
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | 開発 / ビルド / 本番起動 |
| `npm run db:migrate` / `db:migrate:dev` / `db:seed` / `db:reset` | マイグレーション / Seed |
| `npm run worker` | Worker（BullMQ + スケジューラ） |
| `npm run typecheck` / `npm run lint` | 型 / Lint |
| `npm test` / `npm run test:unit` / `npm run test:integration` | Vitest |
| `npm run test:e2e` | Playwright（ビルド + 起動 + E2E） |

## AI プロバイダ

`.env` に `ANTHROPIC_API_KEY` または `OPENAI_API_KEY` を設定すると実 AI が有効になります（`AI_PROVIDER=auto|anthropic|openai|mock`、既定モデルは `claude-opus-5` / `gpt-4.1`。管理画面 → AI設定で変更可）。未設定または `DEMO_MODE=true` の場合は Mock Provider が決定論的に動作します。将来のプロバイダは `registerAIProvider()` で追加できます。

## ライセンス / 注意

各プラットフォームの利用規約・API規約・robots.txt・送信制限を必ず尊重してください。公開 API のないサービスは手動取込＋人間送信（MANUAL_ONLY）が既定です。
