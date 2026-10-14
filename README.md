# pokecardtrade

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

