# PDF-Pro Upgrade — Implementation Report

This report describes the upgrade made to the existing PDF-Pro application. The goal was to fix reliability and correctness problems in the existing tools, add Firebase-based accounts with a centralized 10 MB rule, and modernize the experience — **without** rewriting the app or breaking any of the 16 working PDF tools. Every tool that worked before still works, with the same frontend/backend contract, plus the improvements below.

The work was done by modifying the existing codebase in place. No tool was removed, no duplicate files were introduced, and the code contains no comments, TODOs, or placeholder stubs, in line with the project's code-quality rules.

---

## 1. Filenames are now preserved on download

**Problem:** downloads came back as generic names such as `download.pdf`, losing the user's original filename.

**Fix:** the backend now derives every download name from the uploaded file's original name and sets it on the response. A file called `My_Important_Document.pdf` comes back as `My_Important_Document_compressed.pdf`, `My_Important_Document_split.zip`, `My_Important_Document_numbered.pdf`, and so on, depending on the tool.

The name is produced by `deriveDownloadName()` in `server/utils/fileUtils.js`, which strips the extension, sanitizes the base, and re-appends a per-tool suffix and the correct new extension. Sanitization removes only control characters and the characters that are unsafe in a filename (`\ / : * ? " < > |`); it deliberately **keeps** letters (including unicode), digits, spaces, hyphens, underscores, and dots, so readable names survive intact.

The controller sends the name two ways so it survives cross-origin requests: through the standard `Content-Disposition` header (RFC 5987 encoded) and through a fallback `X-Result-Filename` header. Crucially, the CORS configuration now **exposes** both of these headers to the browser — without that, the frontend could not read the filename across the Vercel↔Render origin boundary, which was the root cause of the lost names. On the frontend, `js/converter.js` parses the returned name and the UI no longer overwrites it with a hard-coded value.

---

## 2. Conversions are faster and cannot crash the server

Heavy operations (Ghostscript compression, LibreOffice conversion, poppler rasterization) are the slow paths. The upgrade addresses them on several fronts, all in `server/`:

- **Concurrency control.** A semaphore (`server/utils/concurrency.js`) caps how many heavy jobs and how many LibreOffice jobs run at once (`MAX_CONCURRENT_HEAVY`, `OFFICE_CONCURRENCY`). This prevents a burst of uploads from exhausting memory on Render's small instances.
- **Hard timeouts.** Every operation is wrapped with a timeout; subprocesses are launched with `execFile` (never a shell) and are killed with `SIGKILL` if they exceed their limit. A stuck job can no longer hang a request forever — it fails cleanly with a `PROCESSING_TIMEOUT`.
- **Guaranteed cleanup.** Uploaded and generated files are removed after the response is sent and also on any error path, so temp directories do not fill up. A background sweep (`server/utils/cleanupTemp.js`) purges anything older than the retention window as a safety net.
- **Crash isolation.** `server/app.js` installs `unhandledRejection` and `uncaughtException` guards, so one bad file or library failure logs the error and returns a friendly message instead of taking the whole backend down.
- **No hung requests.** Every tool handler is wrapped so that an error thrown before processing starts — for example, calling Merge with a single file — is routed to the structured error handler and its staged upload is removed, rather than leaving the request open with no response.

Because subprocesses are spawned with `execFile` and an argument array, untrusted input (filenames, page ranges, passwords) is never concatenated into a shell command, which removes the shell-injection risk entirely.

---

## 3. Predictable states and safe, structured errors

Every API response now follows one contract. Success returns the file. Failure returns:

```json
{
  "success": false,
  "message": "A friendly, user-safe sentence.",
  "error": { "code": "MACHINE_CODE", "message": "A friendly, user-safe sentence." }
}
```

Internal details and stack traces are logged server-side (for 5xx and non-operational errors) but are **never** sent to the browser. The main error codes are:

| Code | HTTP | Meaning |
| --- | --- | --- |
| `NO_FILE` | 400 | No file was supplied. |
| `INVALID_INPUT` | 400/422 | A required option was missing or invalid (e.g. deleting every page). |
| `FILE_CORRUPT` | 422 | The upload was not a readable PDF. |
| `NO_IMAGES` | 422 | Extract-images found nothing to extract. |
| `TOO_MANY_FILES` | 400 | More files than `MAX_FILES`. |
| `AUTH_REQUIRED` | 401 | A guest tried to exceed the 10 MB limit. |
| `INVALID_TOKEN` | 401 | The supplied session token was rejected. |
| `FILE_TOO_LARGE` | 413 | Above the signed-in maximum. |
| `LIMIT_REACHED` | 429 | Usage allowance exceeded (foundation for future limits). |
| `PROCESSING_TIMEOUT` | 504 | The operation ran past its timeout. |
| `INTERNAL` | 500 | Anything unexpected — details stay in the server log. |

On the frontend, the workspace surfaces a clear sequence of states — Uploading, Uploaded, Processing, Almost done, Completed, Failed — driven by `js/app.js` and `css/states.css`. A failed job is never left spinning; it shows the friendly message and a **Try again** button that re-runs the same job with the files still staged, so nothing is lost.

---

## 4. Accounts via Firebase, with a centralized 10 MB rule

Authentication uses **Firebase Authentication** (email/password); the app stores no passwords of its own. On sign-up and each login the client writes a profile document to Cloud Firestore at `users/{uid}` containing `email`, `displayName`, `createdAt`, and `lastLoginAt`, keyed by the Firebase UID. The published `firestore.rules` restrict every user to reading and writing only their own document, and deny everything else by default.

The 10 MB rule is enforced in one place on the backend — the `enforceUploadLimits` middleware (`server/middleware/enforceLimits.js`), applied to **all** tool endpoints:

- Under the guest limit (default 10 MB combined): anyone can proceed, no account needed.
- Over the guest limit and not signed in: rejected with `401 AUTH_REQUIRED` and the exact message *"Files larger than 10 MB require a free PDF-Pro account…"*.
- Signed in: allowed up to the higher authenticated maximum (default 100 MB).

This is enforced server-side and **cannot be bypassed** by calling the API directly. The backend only treats a request as authenticated when the `attachUser` middleware successfully verifies a real Firebase **ID token** with the Admin SDK (`server/utils/firebaseAdmin.js`). A forged or absent token means the request is treated as a guest and the 10 MB ceiling applies. If the server has no Admin credentials at all, it fails closed: nobody can exceed the guest limit, rather than letting large uploads through unauthenticated.

**Exact-10 MB behavior:** the comparison is strictly greater-than against the byte limit (`10 MB = 10 × 1024 × 1024` bytes). A file of exactly 10 MB is allowed for guests; only files *larger* than that require an account.

The same middleware calls a `usageService` allowance check, which is the foundation for future per-day / per-month / premium limits — the hook exists and returns "allowed" today, so limits can be turned on later without touching every endpoint.

---

## 5. Architecture and security hardening

- **CORS is env-driven, not `*`.** `CORS_ORIGINS` lists the exact allowed frontend origins; credentialed CORS is only enabled when the origin is explicit. The needed headers are exposed and preflight is handled.
- **No shell injection**, as described in section 2 (`execFile` with argument arrays).
- **Path-traversal and filename safety**: all output paths are built from sanitized base names plus a random suffix inside known directories; `path.basename` strips any directory components a user tries to smuggle in.
- **Rate limiting** protects the API; the health check is registered before the limiter so uptime probes are never throttled.
- **Secrets never ship to the browser or the repo.** The Admin private key lives only in Render environment variables; `.env.example` contains variable *names* only; `.gitignore` covers `.env`.
- **Cold starts are handled gracefully.** Because Render's free tier sleeps, `js/converter.js` detects a cold start (network error or 502/503/504), shows a "Waking up the server…" state, and retries automatically instead of surfacing a generic failure.

---

## 6. Modern, responsive UI

The existing glassmorphic design was evolved, not replaced. Account features are injected consistently into the navigation on all 18 pages by `js/auth-ui.js` (an avatar menu when signed in, a **Log in** entry when signed out), with matching entries in the mobile menu. New standalone `login.html`, `signup.html`, and `account.html` pages match the site's look. A login modal lets a user who hits the 10 MB gate authenticate in place and continue without losing their staged file.

The layout was audited from 320 px to 1440 px and up. On small screens the navigation collapses into the existing hamburger menu (text buttons and the account control move into it), the account and auth cards reflow to a single column, and the result panel shows the preserved output filename in a wrapping, monospaced chip so long names never overflow.

---

## 7. New and changed files

**New backend/config/docs**

- `firestore.rules` — per-user Firestore security rules.
- `docs/FIREBASE_SETUP.md`, `docs/DEPLOYMENT.md`, `docs/IMPLEMENTATION_REPORT.md` — this documentation set.
- `server/utils/firebaseAdmin.js`, `server/middleware/auth.js`, `server/middleware/enforceLimits.js`, `server/services/usageService.js` — auth and limits.

**New frontend**

- `js/firebase-config.js`, `js/auth.js`, `js/auth-ui.js`, `js/auth-pages.js` — client auth.
- `css/auth.css`, `css/states.css` — account UI and processing states.
- `login.html`, `signup.html`, `account.html` — auth pages.

**Modified**

- `server/app.js`, `server/controllers/pdfController.js`, `server/routes/pdfRoutes.js`, `server/services/pdfService.js` — filename preservation, structured errors, limits pipeline, CORS/exposed headers, crash guards.
- `Dockerfile` (adds Ghostscript and friends), `render.yaml`, `.env.example`, `package.json` (adds `firebase-admin`, drops packages the code no longer uses).
- `js/config.js`, `js/converter.js`, `js/validation.js`, `js/app.js` — API base, cold-start retry, gating, states.
- `index.html`, `all-tools.html`, and all 16 `tools/*.html` — Firebase SDK, auth scripts/styles, and the result-filename element.

---

## 8. What you need to do to go live

1. Follow `docs/FIREBASE_SETUP.md` to create the Firebase project, enable email/password auth, create Firestore, publish `firestore.rules`, and collect the public web config and the Admin service account.
2. Follow `docs/DEPLOYMENT.md` in order: deploy the backend to Render, point the frontend at it, deploy the frontend to Vercel, then set `CORS_ORIGINS` and Firebase authorized domains.
3. Run the smoke-test checklist in the deployment guide — especially the direct-API bypass attempt, which confirms the 10 MB rule is enforced on the server.

One dependency was added (`firebase-admin`); run `npm install` before the first backend deploy so it is present in `package-lock.json` and the Docker build.
