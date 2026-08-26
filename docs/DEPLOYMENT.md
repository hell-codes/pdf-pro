# Deployment Guide

PDF-Pro is two independently deployed pieces:

| Piece | What it is | Where it runs |
| --- | --- | --- |
| **Frontend** | Static HTML / CSS / vanilla JS | Vercel |
| **Backend** | Node + Express API, runs PDF tools via Ghostscript / LibreOffice / poppler / qpdf | Render (Docker) |

They are wired together by two URLs and a CORS allow-list, so the order you deploy in matters. Follow the steps below in sequence.

---

## Where each secret and setting lives

There are two very different classes of configuration. Keeping them separate is what keeps the app secure.

### Frontend — public values, committed to the repo

These ship to the browser and are **meant** to be public. They live in the `js/` folder, not in environment variables.

| File | Value | Notes |
| --- | --- | --- |
| `js/config.js` | `RENDER_BACKEND_URL` | Your Render backend URL, e.g. `https://pdf-pro.onrender.com` |
| `js/firebase-config.js` | `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` | The public Firebase web config. Safe to commit. |

### Backend — secrets, set as environment variables on Render

These must **never** be committed and must **never** be sent to the browser. They are set in the Render dashboard (or via `render.yaml` for the non-secret ones).

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `NODE_ENV` | `production` on Render | No |
| `PORT` | `5000` | No |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | No, but deployment-specific |
| `GUEST_MAX_MB` | Guest upload cap (default `10`) | No |
| `AUTH_MAX_MB` | Signed-in upload cap (default `100`) | No |
| `MAX_FILES` | Max files per request (default `20`) | No |
| `OP_TIMEOUT_MS` | Per-operation timeout (default `120000`) | No |
| `OFFICE_TIMEOUT_MS` | LibreOffice timeout (default `90000`) | No |
| `MAX_CONCURRENT_HEAVY` | Concurrent heavy jobs (default `2`) | No |
| `OFFICE_CONCURRENCY` | Concurrent LibreOffice jobs (default `1`) | No |
| `RATE_LIMIT_MAX` | Requests per 15-min window (default `200`) | No |
| `FIREBASE_PROJECT_ID` | From the Admin service account | **Yes** |
| `FIREBASE_CLIENT_EMAIL` | From the Admin service account | **Yes** |
| `FIREBASE_PRIVATE_KEY` | From the Admin service account | **Yes** |
| `FIREBASE_SERVICE_ACCOUNT` | Alternative: the whole service-account JSON in one variable | **Yes** |

`.env.example` in the repo lists every backend variable name with empty values. Copy it to `.env` for local development. Never put real secrets into `.env.example`, and never commit `.env` (it is already in `.gitignore`).

---

## Step 0 — Set up Firebase first

Complete `docs/FIREBASE_SETUP.md` before deploying. You will come out of it with:

- The **public web config** (six values) for the frontend.
- The **Admin service account** (`project_id`, `client_email`, `private_key`) for the backend.
- Published Firestore security rules.

You can deploy PDF-Pro without Firebase, but account features and the >10 MB tier will be disabled until it is configured.

---

## Step 1 — Deploy the backend to Render

The backend has to exist first, because the frontend needs its URL.

1. Push this repository to GitHub (it is a private repo, which Render supports).
2. In the Render dashboard, click **New → Web Service** and connect the repository.
3. Render detects `render.yaml`. It builds from `Dockerfile`, which installs Node plus the system tools the PDF pipeline needs: LibreOffice, poppler-utils, Ghostscript, qpdf, and Liberation fonts.
4. Set the environment variables that `render.yaml` marks as `sync: false`, because they are not stored in the repo:
   - `CORS_ORIGINS` — you do not have the Vercel URL yet. Set it to a placeholder for now (for example `https://localhost`) and correct it in Step 3.
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — paste from the service-account JSON. When pasting the private key on one line, keep the literal `\n` sequences intact.
5. Deploy. When it finishes, copy the service URL, for example `https://pdf-pro.onrender.com`.
6. Confirm it is alive: open `https://YOUR-BACKEND.onrender.com/api/health`. You should see `status: ok` and `authConfigured: true` (if you set the Firebase secrets).

> **Free plan note:** Render's free web services sleep after inactivity and take up to a minute to wake. The frontend already handles this — it detects a cold start and shows "Waking up the server…" while it retries, instead of failing.

---

## Step 2 — Point the frontend at the backend and Firebase

1. Open `js/config.js` and set the backend URL:

```js
const RENDER_BACKEND_URL = 'https://pdf-pro.onrender.com';
```

The frontend automatically uses a same-origin API when running on `localhost`, and this URL everywhere else, so local development keeps working.

2. Open `js/firebase-config.js` and paste your public Firebase web config (from the Firebase setup guide).
3. Commit and push these two changes.

---

## Step 3 — Deploy the frontend to Vercel

1. In Vercel, click **Add New → Project** and import the same repository.
2. There is no build step — it is a static site. Leave the framework preset as **Other**; `vercel.json` handles the configuration.
3. Deploy. Copy the resulting URL, for example `https://pdf-pro.vercel.app`.

---

## Step 4 — Close the loop: CORS and authorized domains

Now that the frontend URL exists, tell the backend and Firebase to trust it.

1. **Render:** edit `CORS_ORIGINS` to your real Vercel origin, for example:

```
CORS_ORIGINS=https://pdf-pro.vercel.app
```

To allow more than one origin (say a custom domain and preview deployments), separate them with commas:

```
CORS_ORIGINS=https://pdf-pro.vercel.app,https://www.yourdomain.com
```

Save — Render restarts the service. Avoid `*` in production: the backend only enables credentialed CORS when the origin is explicit.

2. **Firebase:** in **Authentication → Settings → Authorized domains**, add your Vercel domain (and any custom domain).

---

## Step 5 — Smoke test the live deployment

Run through this checklist against the production site:

1. **A small file, no account.** Upload a small PDF to the Compress tool. It should process and download as `<original-name>_compressed.pdf` — the original filename is preserved, not `download.pdf`.
2. **Filenames with spaces/unicode.** Try a file like `My Report (v2).pdf`; the download name should keep the readable base name.
3. **The 10 MB gate.** As a guest, try a file larger than 10 MB. You should be prompted to log in with the message about needing a free account, and your file should stay staged.
4. **Log in, then retry.** After signing in, the same large file (up to 100 MB) should process.
5. **Direct-API bypass attempt.** From a terminal, `POST` a >10 MB file straight to `https://YOUR-BACKEND/api/pdf/compress` with no `Authorization` header. It must be rejected with HTTP 401 and an `AUTH_REQUIRED` error — proving the limit is enforced server-side.
6. **Cold start.** If the backend was asleep, the first request should show the "Waking up the server…" state and then succeed, not error out.

---

## Redeploying later

- **Frontend-only change** (HTML/CSS/JS): push to GitHub; Vercel redeploys automatically. No backend restart needed.
- **Backend change** (anything under `server/`, `Dockerfile`, or dependencies): push to GitHub; Render rebuilds the Docker image.
- **Changed an allowed origin or a secret:** update it in the Render dashboard; Render restarts on save.
- **Changed Firestore rules:** re-paste `firestore.rules` in the Firestore **Rules** tab and **Publish** (or `firebase deploy --only firestore:rules`).
