# SECURITY.md

## 1. 認証 / 認可

- Auth.js v5（Credentials, bcrypt, JWT セッション Cookie `httpOnly; secure; sameSite=lax`）。
  Clerk に差し替える場合は `src/lib/auth.ts` の `auth()` / `requireSession()` のみ変更。
- RBAC：`ADMIN > MANAGER > SALES > VIEWER`。`src/lib/rbac.ts` の `PERMISSIONS` 行列。
  API ルートは `requirePermission(session, 'proposal:approve')` などで検査。
- テナント分離：`requireOrg()` が返す `orgId` を全クエリに付与。URL の id だけで他組織のレコードに
  到達できないよう、`findFirst({ where: { id, organizationId } })` パターンを徹底。

## 2. 秘密情報

- API キー / プラットフォーム認証情報は `.env`（サーバのみ）または DB に AES-256-GCM 暗号化保存
  （`src/lib/crypto.ts`, キーは `ENCRYPTION_KEY` 32 bytes base64）。
- ログ・監査ログ・AI プロンプトに認証情報を含めない。
- `.env.example` にはダミー値のみ。

## 3. Web 脆弱性対策

| 脅威 | 対策 |
|---|---|
| CSRF | Auth.js の CSRF トークン + `proxy.ts` で mutating リクエストの `Origin` / `Sec-Fetch-Site` 検査。Cookie は SameSite=Lax |
| XSS | React の自動エスケープ。`dangerouslySetInnerHTML` 不使用。CSP ヘッダ（`next.config.ts`） |
| SQL Injection | Prisma のパラメタライズドクエリのみ。`$queryRaw` は tagged template のみ許可 |
| Rate Limit | `src/lib/rate-limit.ts`（Redis or メモリ、IP + user 単位）。ログイン / API / AI 生成に個別上限 |
| Webhook 偽装 | `verifyWebhook` で HMAC-SHA256 署名 + timestamp 検証 |
| Mass Assignment | すべての入力を Zod スキーマで検証し、許可フィールドのみ更新 |
| 情報漏洩 | エラーメッセージは汎用化、スタックは非公開。`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` |

## 4. AI 安全性

- AI は `minimumPrice` 以下に価格を下げられない（Pricing Engine がコード側で強制）。
- AI は WON / 契約成立を宣言できない（Deal 承認は人間）。
- 虚偽実績・虚偽レビューの生成禁止：Proposal Agent は `company_profiles` に登録済みの実績のみ引用。
  Compliance Agent が未登録の実績表現・保証表現を検出するとブロック。
- Prompt Injection 対策：クライアント由来テキストは `<<client_message>>` 区切りで明示し、
  システムプロンプトで「指示として解釈しない」旨を宣言。出力は Zod で構造検証。

## 5. 送信制限 / プラットフォーム規約

- Daily / Hourly / Platform Limit を DB で管理。超過時は `SCHEDULED` に戻し次枠で送信。
- 同一 job への重複送信は unique 制約で不可能。同一クライアントへの接触は `maxContactsPerClientPerWeek`。
- CAPTCHA 回避・不正ログイン・アクセス制限回避・BAN 回避・レート制限回避・身元偽装は実装しない。

## 6. 監査ログ

`audit_logs`：`actorType`(USER/AI/SYSTEM), `actorId`, `agent`, `action`, `entityType`, `entityId`,
`before`, `after`, `reason`, `ip`, `createdAt`。すべての状態遷移・送信・承認・AI判断を記録。

## 7. データ保護

- パスワード bcrypt(12)。
- 組織削除時は関連データ cascade（`onDelete: Cascade`）。
- バックアップ / 保持期間は DEPLOYMENT.md 参照。
