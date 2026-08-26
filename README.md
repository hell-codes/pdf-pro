# PDF Pro

**The fastest & most beautiful PDF toolkit.**

A production-ready, full-stack PDF converter web app: 16 fully wired tools across conversion, organization, editing, and security, wrapped in a premium glassmorphic UI with dark mode, drag-and-drop uploads, and smooth micro-interactions — built with vanilla HTML/CSS/JS on the front end and Node.js/Express on the back end.

---

## ✨ Features

- **16 working PDF tools** (see below) with real file processing, not mockups
- **Original filenames preserved** on every download — `My_Report.pdf` comes back as `My_Report_compressed.pdf`, not `download.pdf`
- **Free accounts via Firebase** (email/password) with a per-user Firestore profile, so larger files are unlocked once signed in
- **Centralized 10 MB rule**: guests work with files up to 10 MB; larger files require a free account, enforced on the server and not bypassable via the API
- Drag-and-drop upload with clear processing states (Uploading → Processing → Almost done → Completed / Failed), progress bars, and one-click retry
- Cold-start aware: when the free-tier backend is asleep, the UI shows "Waking up the server…" and retries instead of erroring
- Light & dark mode with system-preference detection and persistence
- Fully responsive from 320 px to large screens; desktop and mobile navigation
- Glassmorphism UI, gradient blobs, floating cards, scroll reveals, card tilt, ripple buttons, animated counters, toast notifications
- Structured, user-safe error responses; internal details are logged server-side, never exposed
- Concurrency limits, hard timeouts, crash guards, and an automatic cleanup job that purges working files
- Zero external UI frameworks — no React, Vue, or Bootstrap, per spec

## 🧰 Tools included

| Category | Tools |
|---|---|
| **Convert** | PDF → Word, Word → PDF, PDF → JPG, JPG → PDF, PNG → PDF |
| **Organize** | Merge PDFs, Split PDF, Rearrange Pages |
| **Edit** | Compress PDF, Rotate PDF, Delete Pages, Extract Images, Add Watermark, Add Page Numbers |
| **Security** | Protect PDF (password + AES-256), Unlock PDF |

Two items from the original spec — **OCR-ready structure** and **preview before download** — are cross-cutting behaviors rather than standalone converters: every scanned PDF flows through the same PDF→Word/JPG pipeline (a dedicated OCR text layer is a natural next step — see below), and every tool's result panel shows a preview/download step before the file leaves the server.

## 🏗️ Tech stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (ES6+) — no frameworks — hosted on **Vercel**
- **Backend:** Node.js + Express in **Docker**, hosted on **Render**
- **Auth & profiles:** Firebase Authentication (email/password) + Cloud Firestore; server-side token verification with the Firebase Admin SDK
- **PDF engine:** [`pdf-lib`](https://pdf-lib.js.org/) for merge/split/rotate/delete/rearrange/watermark/page-numbers/image-extraction
- **Compression:** **Ghostscript** for real photo re-encoding, with a `pdf-lib` fallback
- **Images:** [`sharp`](https://sharp.pixelplumbing.com/) for image normalization and JPG optimization
- **Uploads:** `multer` with strict size/type validation
- **Zipping:** `archiver` for multi-file results (split, PDF→JPG, extract-images)

## ⚙️ System dependencies (important)

Three tools call out to system binaries for capabilities that are outside what pure-JS libraries can do. Install these on the server for full functionality — every other tool works with just `npm install`:

| Tool(s) | Requires | Install |
|---|---|---|
| PDF → Word, Word → PDF | **LibreOffice** (`soffice` on PATH) | `sudo apt install libreoffice` (Linux) · `brew install --cask libreoffice` (macOS) |
| PDF → JPG | **Poppler** (`pdftoppm`) | `sudo apt install poppler-utils` (Linux) · `brew install poppler` (macOS) |
| Compress PDF | **Ghostscript** (`gs`) | `sudo apt install ghostscript` (Linux) · `brew install ghostscript` (macOS) |
| Protect / Unlock PDF | **qpdf** | `sudo apt install qpdf` (Linux) · `brew install qpdf` (macOS) |

If a binary isn't found, that endpoint returns a clear error message rather than failing silently — everything else keeps working. On Render these are all installed for you by the `Dockerfile`.

## 🚀 Installation

```bash
git clone <your-repo-url> pdf-pro
cd pdf-pro
npm install
cp .env.example .env
npm start          # production
npm run dev         # with nodemon, auto-restart
```

The app serves both the frontend and API from a single Express server at `http://localhost:5000` for local development. In production the frontend (Vercel) and backend (Render) are deployed separately — see **Deployment** below.

Accounts are optional locally: without Firebase configured, every tool still works for files under the guest limit, and account features are hidden automatically.

## ☁️ Deployment

PDF-Pro deploys as a static frontend on **Vercel** and a Dockerized API on **Render**, with **Firebase** for auth and profiles. Because the two halves reference each other's URLs, deploy them in order. Full step-by-step instructions:

- **[`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md)** — create the Firebase project, enable email/password auth, create Firestore, publish `firestore.rules`, and get both the public web config and the Admin service account.
- **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** — the exact deployment order, which values are public (frontend) vs. secret (backend), and a live smoke-test checklist.
- **[`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md)** — what changed in this upgrade and why.

Environment variables are documented (names only, no secrets) in `.env.example`. Frontend configuration lives in `js/config.js` (backend URL) and `js/firebase-config.js` (public Firebase config); backend secrets live only in Render environment variables.

## 📁 Folder structure

```
PDF-Pro/
├── index.html            # Homepage
├── all-tools.html         # Full tool directory
├── login.html, signup.html, account.html   # Firebase auth pages
├── tools/                  # 16 individual tool workspace pages
├── assets/                 # icons, images, logos, fonts
├── css/                    # variables, style, navbar, hero, cards, upload, footer, animations, auth, states, responsive
├── js/                     # utils, theme, toast, validation, dragdrop, upload, config, converter, animations, app
│                           #   + firebase-config, auth, auth-ui, auth-pages
├── server/
│   ├── app.js              # Express entry point
│   ├── config/              # environment config
│   ├── routes/               # /api/* route definitions
│   ├── controllers/          # request handlers per tool
│   ├── services/              # pdf-lib / sharp / LibreOffice / Ghostscript / qpdf logic
│   ├── middleware/             # upload, auth, limits, error handler
│   └── utils/                  # filesystem helpers, cleanup, concurrency, Firebase Admin
├── docs/                    # Firebase setup, deployment, implementation report
├── firestore.rules          # per-user Firestore security rules
├── Dockerfile               # backend image (installs LibreOffice, poppler, Ghostscript, qpdf)
├── render.yaml              # Render service + env var definitions
├── uploads/, converted/, temp/  # working directories (auto-cleaned)
└── package.json
```

## 🔒 Security

- File type validated by both extension and MIME type, client- and server-side
- Tiered size limits: **10 MB for guests, 100 MB for signed-in users** (configurable), enforced by centralized server-side middleware — the guest limit is not bypassable by calling the API directly
- Firebase ID tokens are verified server-side with the Admin SDK; the Admin private key stays in backend environment variables and is never shipped to the browser or committed
- Firestore security rules restrict each user to reading/writing only their own `users/{uid}` profile
- PDF tools call system binaries via `execFile` with argument arrays — no shell, so no shell-injection surface
- Output paths are built from sanitized names inside known directories, guarding against path traversal
- Uploaded and generated files are deleted immediately after each response, with a background sweep as a safety net
- Env-driven CORS allow-list (no wildcard in production), API rate limiting, and `helmet` security headers
- Structured error responses only — stack traces and internal details are logged server-side, never returned to the client

## 📈 Scaling this project

This is a genuinely working foundation, not a prototype shell — but a few things are worth knowing if you're taking it to production:

- **Compression** now runs through Ghostscript (`gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook`) for real image re-encoding, with a `pdf-lib` object-stream pass as a safe fallback if Ghostscript is unavailable.
- **OCR**: for scanned PDFs, add `tesseract.js` or a Tesseract CLI pass over the rasterized pages (the same pipeline used by PDF→JPG) to produce a searchable text layer before Word conversion.
- **Image extraction** reads embedded image streams directly from the PDF's object table — reliable for the vast majority of PDFs, but very unusual encodings may need a fallback path.
- For high-traffic deployments, move file processing into a queue (e.g. BullMQ + Redis) so large conversions don't block the request thread.

## 🗺️ Future improvements

- Conversion history per account (the Firestore profile is already in place to build on)
- Daily / monthly / premium usage tiers (the server-side allowance hook is already wired, currently unlimited)
- Batch processing across multiple tools in one flow
- Real-time collaborative PDF annotation
- Tesseract-based OCR text layer for scanned documents
- Cloud storage integrations (Google Drive, Dropbox)

## 📄 License

MIT — free to use, modify, and deploy.
