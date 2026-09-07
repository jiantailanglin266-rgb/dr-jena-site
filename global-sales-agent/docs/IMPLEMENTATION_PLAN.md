# IMPLEMENTATION_PLAN.md

| STEP | 内容 | 主な成果物 |
|---|---|---|
| 1 | 基盤 | `global-sales-agent/` Next.js 16 + TS + Tailwind 4 + ESLint + Docker + `.env.example` |
| 2 | Database / Auth | Prisma schema (全テーブル), migration, seed, Auth.js, RBAC, tenant |
| 3 | Dashboard | App shell (sidebar / topbar), KPI, Funnel, Charts, i18n(ja/en) |
| 4 | Job Discovery | Connector Architecture, registry, demo-marketplace + Fake Marketplace API, Scout Agent, Jobs UI |
| 5 | AI Analysis | AI Provider abstraction (Anthropic / OpenAI / Mock), Analyst Agent, Opportunity Score, auto-exclusion |
| 6 | Proposal Generator | Company Profile UI, Proposal Agent (10構造, 3 lengths, 6 tones), Language Layer, Translation Agent, Proposal Queue, Compliance Agent, Send Engine + Limits |
| 7 | Conversation Engine | Conversation / Message / Thread Memory, reply ingestion (webhook / polling / demo) |
| 8 | Reply AI | Reply Intelligence (11 categories, sentiment, intent, purchase probability, next_best_action), AI reply draft |
| 9 | Negotiation | Pricing Engine, Negotiation Agent, Quote, Human Approval for price |
| 10 | CRM | Companies / Contacts / Opportunities / Deals / Activities / Tasks, Closing Agent, Deal Summary, human WON approval |
| 11 | Automation | Rule Engine, seed rules, No-code Rule Builder, Supervisor orchestration, automation levels |
| 12 | Analytics | Funnel, Platform / Country / Language / Category breakdowns, Performance Memory, A/B, AI cost (daily / monthly / per lead / proposal / reply / won) |
| 13 | Platform Connectors | coconala / crowdworks / lancers / upwork / freelancer / peopleperhour / generic-api / manual-import (interface + mock + settings UI) |
| 14 | Security | proxy (auth guard, CSRF origin check, rate limit), headers, encryption, audit log UI |
| 15 | Testing | Vitest unit/integration, Playwright E2E (発見→解析→提案→翻訳→承認→返信解析→AI返信→価格制限→受注→CRM) |
| 16 | Deployment | Dockerfile, docker-compose, README / SETUP / DEPLOYMENT / API docs |

各 STEP 完了時に `npm run typecheck` / `npm run lint` / `npm run build` / `npm test` を通す。
