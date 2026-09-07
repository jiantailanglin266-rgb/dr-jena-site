# PLATFORM_CONNECTOR_SPEC.md

## 1. 目的

世界中のスキルマーケット / フリーランスマーケットプレイスを **プラグイン方式** で追加できる
Platform Connector Architecture を定義する。ハードコードではなく `registry` に登録する。

```
src/lib/connectors/
├─ types.ts            PlatformConnector インターフェース / 正規化 Job 型
├─ registry.ts         登録・解決（key → connector）
├─ base.ts             共通ユーティリティ（正規化、通貨、日付）
├─ coconala/
├─ crowdworks/
├─ lancers/
├─ upwork/
├─ freelancer/
├─ peopleperhour/
├─ generic-api/        任意の JSON API（マッピング設定でフィールド対応）
├─ manual-import/      CSV / JSON / 手動フォームでの取り込み
└─ demo-marketplace/   Fake Marketplace API（デモ）
```

## 2. インターフェース

```ts
interface PlatformConnector {
  key: string;                       // 'upwork'
  displayName: string;
  capabilities: {
    discover: boolean;               // 案件取得
    sendProposal: boolean;           // 公式APIで提案送信可能か
    fetchReplies: boolean;           // 返信取得
    webhook: boolean;                // Webhook 受信
  };
  compliance: {
    officialApi: boolean;            // 公式API有無
    automatedSendingPolicy: 'ALLOWED' | 'RESTRICTED' | 'UNKNOWN' | 'PROHIBITED';
    defaultSendMode: SendMode;       // 上記に応じた既定
    termsUrl?: string;
    notes: string;                   // 規約要点（人間向け）
  };
  discover(ctx: ConnectorContext, params: DiscoverParams): Promise<NormalizedJob[]>;
  sendProposal?(ctx, input: SendProposalInput): Promise<SendResult>;
  fetchReplies?(ctx, since: Date): Promise<InboundMessage[]>;
  verifyWebhook?(rawBody: string, headers: Headers, secret: string): boolean;
  testConnection(ctx): Promise<{ ok: boolean; message: string }>;
}
```

`ConnectorContext = { orgId, platformAccount(復号済み credentials), settings, logger }`

## 3. 正規化 Job モデル

```
platform, job_id, job_url, client_name, client_country, client_language,
project_title, project_description, category, required_skills[],
budget_min, budget_max, currency, deadline, proposal_deadline,
number_of_competitors, client_rating, client_history, payment_verified,
posted_at, raw_text, source_metadata(JSON)
```

Prisma `Job` に 1:1 対応。`(organizationId, platformKey, externalJobId)` でユニーク。

## 4. 各プラットフォームの扱い（規約優先）

| Platform | 公式API | 自動送信 | 既定 sendMode | 実装状態 |
|---|---|---|---|---|
| Upwork | あり（GraphQL, OAuth2、提案送信は Enterprise 系権限） | RESTRICTED | MANUAL_APPROVAL | Interface + Mock。実API接続は `client.ts` の差し替え |
| Freelancer.com | あり（REST, OAuth2、bid 投稿API有） | ALLOWED（API規約内） | MANUAL_APPROVAL | 同上 |
| PeoplePerHour | 公開APIなし | UNKNOWN | MANUAL_ONLY | 取込は manual-import / 提案は候補生成のみ |
| ココナラ | 公開APIなし。自動投稿は規約上不可 | PROHIBITED | MANUAL_ONLY | 候補生成＋人間コピー送信 |
| クラウドワークス | 公開APIなし（旧APIは終了）。自動化は規約で制限 | PROHIBITED | MANUAL_ONLY | 同上 |
| ランサーズ | 公開APIなし | PROHIBITED | MANUAL_ONLY | 同上 |
| Fiverr / Indeed / LinkedIn | 公式APIは限定的 | UNKNOWN | MANUAL_ONLY | generic-api / manual-import で対応 |
| generic-api | 任意 JSON API | 設定次第 | MANUAL_APPROVAL | 動作 |
| manual-import | — | — | MANUAL_ONLY | 動作 |
| demo-marketplace | Fake API | ALLOWED | AUTO 可 | 完全動作 |

**MANUAL_ONLY**：システムは提案候補を生成し、担当者が提案文をコピーして各サービスの正規UIから送信。
送信後「送信済みにする」を押すと `SENT` として履歴・制限カウントに反映される。

## 5. 禁止事項（Connector 実装ルール）

- スクレイピングで規約違反となるアクセス、robots.txt 無視、CAPTCHA 回避、ヘッドレスブラウザによる
  ログイン偽装、レート制限回避、User-Agent 偽装は実装しない。
- 取得系も公式API または ユーザーが自ら取り込むデータ（manual-import）に限定。
- 送信系は公式APIで明示的に許可されている場合のみ `sendProposal` を実装。

## 6. 認証情報

`platform_accounts.credentialsEncrypted` に AES-256-GCM（`ENCRYPTION_KEY`）で保存。
管理画面で入力・テスト接続。ログに平文を出さない。

## 7. Webhook

`/api/webhooks/[platformKey]`：`verifyWebhook` で HMAC 署名検証 → `InboundMessage` を
Conversation にひも付け → `REPLY_RECEIVED` イベント発火。

## 8. 追加手順（新コネクタ）

1. `src/lib/connectors/<key>/index.ts` に `PlatformConnector` 実装
2. `registry.ts` に登録
3. `prisma/seed.ts` の `platforms` に定義を追加（または管理画面から追加）
4. `tests/unit/connectors/<key>.test.ts` で normalize / compliance のテスト
