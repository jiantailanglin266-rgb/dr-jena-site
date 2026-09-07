# AUTOMATION_ENGINE.md

## 1. ルールモデル

```ts
AutomationRule {
  id, organizationId, name, enabled, priority,
  trigger: 'JOB_ANALYZED' | 'JOB_QUALIFIED' | 'PROPOSAL_DRAFTED' | 'REPLY_RECEIVED'
         | 'REPLY_ANALYZED' | 'QUOTE_REQUESTED' | 'VERBAL_ACCEPT' | 'SCHEDULE',
  conditions: Condition[]   // AND 結合。OR は group で表現
  actions: Action[]
}
Condition = { field, op, value }            // field 例: analysis.fitScore, job.budgetMax, reply.category
           | { any: Condition[] }           // OR
           | { all: Condition[] }           // AND
op: gt gte lt lte eq neq in not_in contains not_contains exists
Action = { type: 'CREATE_PROPOSAL', params: { length, tone, variant } }
       | { type: 'EXCLUDE_JOB' }
       | { type: 'SET_LEAD_STATUS', params: { status } }
       | { type: 'GENERATE_REPLY' }
       | { type: 'GENERATE_NEGOTIATION_REPLY' }
       | { type: 'REQUEST_HUMAN_APPROVAL', params: { reason } }
       | { type: 'CREATE_TASK', params: { title } }
       | { type: 'APPROVE_PROPOSAL' }          // AUTO プラットフォームのみ有効
       | { type: 'CREATE_DEAL_SUMMARY' }
       | { type: 'NOTIFY', params: { channel } }
```

## 2. 評価コンテキスト

```
{
  job: { budgetMin, budgetMax, currency, budgetUsd, category, clientCountry, clientLanguage, clientRating, paymentVerified, competitors, platformKey, requiredSkills[] },
  analysis: { fitScore, profitScore, clientQualityScore, winProbability, urgencyScore, riskScore, opportunityScore, estimatedHours, riskFlags[] },
  reply: { category, sentiment, intent, purchaseProbability, urgency },
  opportunity: { status },
  proposal: { status, sendMode },
  org: { automationLevel, plan }
}
```

`src/lib/automation/conditions.ts` は dot-path で安全に値を解決（未定義 → 条件不成立）。

## 3. 実行

```
dispatch(event) → loadRules(orgId, trigger, enabled) → sort(priority desc)
 → for rule: if evaluate(conditions, ctx) → for action: execute(action, ctx)
 → automation_runs に (rule, matched, actions, result, error) を記録
 → audit_logs に actorType=AI, agent='automation'
```

- 同一トリガーで複数ルールが一致した場合はすべて実行（`stopOnMatch: true` で停止可）。
- アクションは冪等（重複提案は Proposal の unique 制約で防止）。
- `automationLevel` が MANUAL のときは `CREATE_PROPOSAL` 等の生成系のみ実行し、
  `APPROVE_PROPOSAL` は無視（承認は人間）。

## 4. 既定ルール（Seed）

1. **High-fit auto proposal**：JOB_ANALYZED, fitScore > 85 AND budgetUsd > 1000 AND clientRating > 4.5 AND riskScore < 20 → CREATE_PROPOSAL(STANDARD, Consultative)
2. **Low score exclusion**：JOB_ANALYZED, opportunityScore < 40 → EXCLUDE_JOB
3. **Negotiation reply**：REPLY_ANALYZED, reply.category = PRICE_NEGOTIATION → GENERATE_NEGOTIATION_REPLY
4. **Question reply**：REPLY_ANALYZED, reply.category in [QUESTION, TECHNICAL_QUESTION, REQUEST_PORTFOLIO] → GENERATE_REPLY
5. **Meeting**：REPLY_ANALYZED, category = REQUEST_MEETING → SET_LEAD_STATUS(MEETING_REQUESTED) + CREATE_TASK
6. **Acceptance**：REPLY_ANALYZED, category = ACCEPTANCE → CREATE_DEAL_SUMMARY + REQUEST_HUMAN_APPROVAL

## 5. No-code Rule Builder

`/automation` 画面：トリガー選択 → 条件行（フィールド / 演算子 / 値）を追加 → アクション追加 → 保存。
テスト実行（過去案件に対する dry-run）で一致件数を確認できる。

## 6. 安全ガード

- `APPROVE_PROPOSAL` は platformAccount.sendMode = AUTO かつ Compliance OK のときのみ。
- Pricing Engine の `minimumPrice` 以下の提案はルール経由でも生成不可。
- `WON` への遷移はルールから直接行えない（Human Approval 必須設定時）。
