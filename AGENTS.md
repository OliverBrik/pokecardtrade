# AGENTS.md

## Project

- This is a Vue 3 application built with Vite.
- Use JavaScript and Vue single-file components unless the task requires otherwise.
- Keep UI components in `src/components/` and route-level views in `src/views/`.
- Define routes in `src/router/index.js` and keep the application entry point in `src/main.js`.

## Commands

- Start development: `npm run dev`
- Create a production build: `npm run build`
- Preview a production build: `npm run preview`
- Run linting: `npm run lint`

## Firebase

- Firebase client configuration belongs in the root `.env` file using `VITE_FIREBASE_*` variables.
- Read Firebase configuration through `import.meta.env` in `src/firebase.js`.
- Never commit `.env`, service-account JSON, private keys, passwords, or other server credentials.
- Firebase web API configuration is client-side configuration; protect data with Firebase Authentication and Firestore/Storage security rules.
- Do not put admin Firebase SDK code or secrets in the Vue frontend.

## Change Guidelines

- Prefer small, focused changes that follow the existing Vue and CSS patterns.
- Do not change Firebase security rules or deployment configuration without verifying the intended access model.
- Run the narrowest relevant check after changes, then run `npm run build` when the application code changes.
- Do not commit generated output such as `dist/` or dependency folders.

