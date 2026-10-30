# pokecardtrade

## Submission demo and external availability

- `/demo` is a public, interactive, explicitly fictional trade walkthrough: set goal, mutual match, proposal, acceptance, confirmation and local demo collection update. It never writes to Firebase and never sends messages to real people. It is a demonstration, not proof of a deployed two-user trade.
- During a TCGdex outage, Explore/search, card saving and Goals can use bundled official TCGdex metadata for **151 (207 cards)** and **Obsidian Flames (230 cards)**. Complete checklists are included; other sets/cards may be unavailable. The source commit and snapshot date are recorded in `src/data/catalogue-snapshot.js`; its MIT license is included alongside it. Regenerate with `node scripts/build-catalogue-snapshot.mjs` when the source is accessible.
- Successful API responses are cached in browser local storage for up to seven days and can be used when a later request fails. The visible limited-catalogue banner indicates fallback use. Bundled metadata has no prices; cached prices are historical estimates, not live quotations. Images still depend on the remote image CDN.
- Saved collection documents can display without waiting for price requests. Firebase Authentication and Firestore are still required for real accounts, saving, listings and goals. Trading requires the separate Functions deployment described below; the last attempt was blocked by the CLI account's missing `iam.serviceAccounts.ActAs` permission.

For an API-independent presentation, open `/demo`. For the real feature flow, sign in, open Goals, choose 151 or Obsidian Flames, save a goal and add missing cards to the wishlist. Do not describe the demo as a completed live trade or the bundled catalogue as current market-price data.

## Collection goals

`/goals` lets signed-in collectors keep up to ten private set goals. Goals are stored on the owner's private `profiles/{uid}` document as `collectionGoals`, using the existing owner access model; they are never copied to `publicProfiles`. No new rules or Cloud Functions deployment is required for this feature when the repository's current profile/wishlist rules are deployed.

Progress counts unique catalogue card IDs, including secret cards, with one copy in any variant. It respects the chosen language and minimum condition and is not a variant master-set tracker. The checklist uses English TCGdex set identities; regional sets are not mapped automatically. An incomplete or unavailable catalogue is shown as an error rather than a completion percentage.

Adding missing cards to the wishlist preserves existing entries and their preferences. Large updates run in chunks of 100; partial failures report the completed count and can be retried. Removing a goal keeps collection and wishlist entries. Wishlist entries are not automatically deleted when cards are acquired.

`/trading?goal=SET_ID` filters the existing consented, reciprocal wishlist matches to cards still missing from that goal. Ranking is by distinct gaps filled among the collectors loaded so far; use “Check more collectors” to continue pagination. Proposal previews account for outgoing last copies as well as incoming cards. They are estimates, do not reserve stock and do not automatically transfer inventory. Both collectors still update their collections after the physical exchange.

## Builds and Hosting deployment

Local development reads the root `.env` with the six `VITE_FIREBASE_*` values used in `src/firebase.js`. Production builds validate that all six are present and the project matches `.firebaserc`.

GitHub Hosting workflows use Node 22, run `npm ci`, `npm run lint:check` and `npm test`, then run `npm run config:hosting` before building. This downloads the project's public web configuration from its Firebase Hosting `/__/firebase/init.json` endpoint and writes an ignored `.env.production.local`. It does not download server credentials or change the local `.env`. Missing, unavailable or mismatched configuration stops deployment. The existing Hosting service-account secret is still required by the deployment action.

To reproduce the production configuration locally, run `npm run config:hosting` followed by `npm run build`. Remove `.env.production.local` when you want production builds to use only your root `.env` again. Do not commit environment files or `.firebase` deploy caches.

These workflows deploy Hosting only. Firestore rules, Storage rules and Cloud Functions need separate deployment with an authorized account. Compare the active rules with the repository before deploying: changes made directly in the Firebase console are not automatically saved to Git.

### Trading backend deployment

Hosting success does not mean the trading server is deployed. The frontend calls `findTradeMatches`, `sendTradeProposal` and `respondToTrade` in `us-central1` on `pokecardtrade-8cdec`. HTTP 404 at these URLs means the frontend cannot reach these functions at its configured location.

With Node 22, an installed Firebase CLI and an account authorized to deploy Cloud Functions, run `npm ci --prefix functions`, `npm run test:trading`, then `npm run deploy:trading`. This deploys only the three trading callables, not the admin account-creation function or security rules. The project must have the billing/API setup required by Cloud Functions. After deployment, verify that an unauthenticated callable request returns an authentication error instead of 404, then test matching and a full proposal with two opted-in test accounts.

Hosting HTML and SPA routes revalidate on navigation. Hashed `/assets/` files retain long-lived caching. A tab that was already open before a deployment still needs a reload to run the new JavaScript.

The root npm override pins Firestore's Node-only `@grpc/grpc-js` dependency to patched version 1.14.7 because Firebase 12.19.0 still requests the old 1.9 series. Remove the override when Firebase requests a patched version itself. This does not update or audit the separate `functions/` dependency tree.

## Marketplace

- `/marketplace`: active listings, filters and pagination; `?tab=mine` shows your own listings, including sold and withdrawn entries. Relisting a collection entry reuses its listing record.
- `/marketplace/create`: choose an owned card, set quantity, EUR price, shipping and optional photos.
- `/marketplace/:id`: listing details, seller enquiry and owner controls.
- `/messages`: private listing conversations for buyers and sellers.

There is one active listing per collection entry. A listing reserves its quantity: while active, the collection entry cannot be removed or changed to another variant, language or condition. Marking a listing sold deducts the listed quantity from the collection in the same transaction. Withdrawal keeps the cards in the collection. Prices are stored as integer cents; shipping is charged once for the listing quantity.

Photos use Firebase Storage and are public listing content. They accept JPEG, PNG and WebP, at most 5 MB each and four per listing. Public documents contain a seller display name and card details; account emails and private collection data are not published. Payment and delivery are arranged between the collectors.

### Firebase setup and validation

Enable Firebase Storage on the existing Firebase project and use its bucket in `VITE_FIREBASE_STORAGE_BUCKET`. Deploy `firestore.rules` and `storage.rules` using the Firebase CLI before using the live marketplace. Storage rules use Firestore to check listing visibility; Firebase may require granting its cross-service rules access during deployment.

Run `npm run test:marketplace` for isolated service tests and `npm run build` for the production build. The service tests do not verify deployed security rules. Before deployment, use the Firebase emulator to verify that a second user cannot edit the seller's listing, reduce reserved stock, access private inquiries, or upload to another user's photo path. Also verify anonymous active-listing reads, withdrawal, sold-stock transactions and buyer/seller replies.

The initial catalogue fetches active listings and applies search, sorting and pagination locally. For a large marketplace, replace this with indexed server queries or a dedicated search service.

