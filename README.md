# Job Application Tracker

A fully encrypted, offline-first job application tracker that runs as a static site on GitHub Pages. Your data never leaves the browser unencrypted.

## Security Model

**The code is public. The data is private.**

This app uses the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to encrypt all sensitive data at rest in the browser:

- **Key derivation:** PBKDF2 with 600,000 iterations and SHA-256, producing a 256-bit AES key from your passphrase
- **Encryption:** AES-GCM with random 12-byte IV per record
- **Storage:** Encrypted blobs in IndexedDB via [Dexie.js](https://dexie.org/)
- **No server:** Zero network requests. No telemetry. No analytics. No backend.

### What's encrypted
All sensitive fields (notes, contact info, salary data, JD text, prep guides, retrospectives, resume file data) are encrypted before being stored in IndexedDB. Only fields needed for querying (status, dates, company name, application IDs) remain in plaintext in the local database.

### What's NOT encrypted
- The source code (it's a public repo)
- IndexedDB query indexes (status, company name, dates) — these enable filtering without decrypting everything

### No recovery
Your passphrase is the sole decryption key. It is never stored anywhere. If you forget it, your data is unrecoverable. This is by design.

## Features

- **Dashboard** — total applications, response rate, interview-to-offer conversion, weekly application trend, follow-up reminders
- **Applications** — full CRUD with status tracking, tagging, search/filter, salary range, contacts
- **Resume Management** — upload PDF/DOCX, tag versions, link to applications
- **Prep Library** — company research, talking points, anticipated questions, story bank links per application
- **Interview Rounds** — track each round with type, date, interviewers
- **Retrospectives** — structured post-interview reflection with confidence rating
- **Timeline** — visual countdown to upcoming interviews
- **PDF Export** — print/save any application's full history for offline review
- **Encrypted Backup/Restore** — export all data as an encrypted JSON file, import on another device
- **Dark mode**

## Backup & Restore

### Export
Click the 💾 button → Export Backup. Downloads a `.json` file containing all your encrypted data. This file is still encrypted with your passphrase — it's safe to store in a private gist or cloud storage.

### Import
Click 💾 → Import. Select a previously exported `.json` file. This replaces all current data.

### Cross-device sync
There's no automatic sync. To move data between devices:
1. Export on device A
2. Transfer the file (email to yourself, private gist, USB, etc.)
3. Import on device B
4. Enter the same passphrase

## Development

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
```

The `dist/` folder is a static site. Deploy it anywhere that serves static files.

### GitHub Pages

1. Push to your repo
2. In repo Settings → Pages, set source to GitHub Actions
3. Use a workflow that runs `npm run build` and deploys `dist/`

Or use `base: '/your-repo-name/'` in `vite.config.js` (already configured as `/jobhunt/`).

## Tech Stack

- React 19 + Vite 8
- Dexie.js (IndexedDB)
- Web Crypto API (PBKDF2 + AES-GCM)
- date-fns
- Zero external UI libraries
