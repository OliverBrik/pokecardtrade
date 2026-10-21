# Trading

## Implemented

- Authenticated `/trading` page with explicit matching consent.
- Owned entries have `tradeQuantity`; the remaining copies are kept. Existing `forTrade` entries without this field retain their previous meaning (all owned copies marked for trade).
- Wishlist preferences: any/specific variant, any/specific language and minimum acceptable condition. Existing wishes default to any variant/language/condition.
- Mutual matching runs in a callable Cloud Function. It only returns relevant offered cards and the collector's already-public name/location. It does not expose complete wishlists, private profiles or unrelated collection entries.
- Participants must opt in and have a public profile sharing either trade cards or the collection. Changing profile visibility removes them from future matches. Disabling matching clears the current results; existing proposals remain visible to their participants.
- Matching checks 10 participants per request; **Check more collectors** continues the scan. Ranking applies to matches loaded so far.
- Available quantities are `min(marked trade quantity, owned quantity - active sale quantity)`, never below zero.
- Proposals contain 1–10 collection entries on each side and exact positive quantities. Creation and acceptance check current stock, variants, language and condition in a Firestore transaction.
- Private proposal conversation, acceptance/decline/cancellation and completion confirmed separately by both collectors.
- Proposal retries use a stable UUID to avoid duplicates. Cards are not reserved, payment/delivery are not processed and inventory is not transferred automatically. Users update their own collections after an exchange.

## Access model

| Path | Client access |
| --- | --- |
| `tradingMembers/{uid}` | Owner only; consent consists of `enabled` and `updatedAt`. Discovery is server-only. |
| `profiles/{uid}/wishlist/{cardId}` | Remains owner-only. Matching uses the Admin SDK after verifying consent. |
| `trades/{id}` | Participants can read/query; clients cannot write. Callable functions enforce participant roles and status transitions. |
| `trades/{id}/messages/{id}` | Participants can read and append their own messages, up to 2,000 characters. No edits or deletion. |

Status transitions: recipient accepts/declines `pending`; sender can cancel `pending`; either participant can cancel `accepted`. Completion remains `accepted` until both participants confirm, then becomes `completed`. Terminal proposals cannot be reopened. An accepted proposal does not reserve stock against other proposals.

## Local checks

```powershell
node --test tests/*.test.mjs
npm run build
npm run dev:trading-preview
```

Open `http://localhost:5174/tests/trading-preview.html` for the isolated browser fixture. It uses the actual Trading view/components and synthetic in-memory services. The banner explicitly identifies the fixture. Its configuration is separate from the normal app and build. It must not be used to claim successful Firebase integration.

## Deployment and remaining verification

Local verification: all 22 tests passed, `npx eslint src functions tests` and `git diff --check` passed, and the production build succeeded (with Vite's existing large-chunk warning). The actual app redirected a signed-out browser from `/trading` to login with the intended return URL. In the isolated browser fixture, consent, mutual matches, exact proposal quantities, recipient acceptance, one-sided completion waiting for the other collector, and private conversation submission were exercised. At a 390px viewport the page and proposal dialog had no horizontal overflow. These browser checks used synthetic data, not live Firebase accounts.

The frontend requires the updated Firestore rules and these three new callable functions in the same Firebase project. They use the existing default Functions region (`us-central1`) and existing Firebase dependencies. No extra Firestore composite index is needed for the implemented queries.

From an account with the required project permissions:

```powershell
npm --prefix functions install
firebase deploy --only "firestore:rules,functions:findTradeMatches,functions:sendTradeProposal,functions:respondToTrade"
```

Publish the frontend through the project's normal hosting workflow after checking the backend. No live deployment was performed as part of this change.

Validation on 2026-10-20: the authenticated rules dry run was blocked by HTTP 403 on `serviceusage.googleapis.com`: the connected CLI identity lacks `serviceusage.services.use` for project `pokecardtrade-8cdec`. A project administrator needs to verify the intended account and its deployment permissions. Do not broaden database read rules to work around this.

The automated tests use isolated Firestore boundaries, not the Firebase emulator. Deployed rules and full two-account integration remain unverified. Before release, verify with two disposable test accounts:

1. Signed-out visitors are redirected from `/trading`; owners can edit quantities/preferences, outsiders cannot read wishes or matching consent.
2. Opted-out/private-profile collectors never appear. Opting in with compatible cards and wishes produces a mutual match; mismatched variant/language/minimum condition does not.
3. An active sale removes its quantity from match availability. Changing stock after search prevents sending/accepting an unavailable proposal.
4. A third account cannot read proposals or their messages, create a proposal directly in Firestore, or perform participant actions.
5. Send a proposal, reply, accept and confirm completion with both accounts. Only the recipient can accept; one confirmation alone is insufficient.
6. Withdraw consent and change profile visibility; refresh the other account's matches. Existing proposals remain private and accessible only to their participants.

Set completion tracking, automatic inventory transfer, notifications and reviews are subsequent features, not included in this version.
