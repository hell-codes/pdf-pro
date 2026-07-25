# PDF Pro

**The fastest & most beautiful PDF toolkit.**

A production-ready, full-stack PDF converter web app: 16 fully wired tools across conversion, organization, editing, and security, wrapped in a premium glassmorphic UI with dark mode, drag-and-drop uploads, and smooth micro-interactions — built with vanilla HTML/CSS/JS on the front end and Node.js/Express on the back end.

---

## ✨ Features

- **16 working PDF tools** (see below) with real file processing, not mockups
- Drag-and-drop upload with live progress bars, thumbnails, and validation
- Light & dark mode with system-preference detection and persistence
- Fully responsive: mobile, tablet, laptop, and large-screen layouts
- Glassmorphism UI, gradient blobs, floating cards, scroll reveals, card tilt, ripple buttons, animated counters, toast notifications
- Centralized error handling and rate limiting on the API
- Automatic cleanup job that purges uploaded/converted files after 1 hour
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

- **Frontend:** HTML5, CSS3, vanilla JavaScript (ES6+) — no frameworks
- **Backend:** Node.js + Express
- **PDF engine:** [`pdf-lib`](https://pdf-lib.js.org/) for merge/split/rotate/delete/rearrange/watermark/page-numbers/image-extraction
- **Images:** [`sharp`](https://sharp.pixelplumbing.com/) for image normalization and JPG optimization
- **Uploads:** `multer` with strict size/type validation
- **Zipping:** `archiver` for multi-file results (split, PDF→JPG, extract-images)

## ⚙️ System dependencies (important)

Three tools call out to system binaries for capabilities that are outside what pure-JS libraries can do. Install these on the server for full functionality — every other tool works with just `npm install`:

| Tool(s) | Requires | Install |
|---|---|---|
| PDF → Word, Word → PDF | **LibreOffice** (`soffice` on PATH) | `sudo apt install libreoffice` (Linux) · `brew install --cask libreoffice` (macOS) |
| PDF → JPG | **Poppler** (`pdftoppm`) | `sudo apt install poppler-utils` (Linux) · `brew install poppler` (macOS) |
| Protect / Unlock PDF | **qpdf** | `sudo apt install qpdf` (Linux) · `brew install qpdf` (macOS) |

If a binary isn't found, that endpoint returns a clear error message rather than failing silently — everything else keeps working.

## 🚀 Installation

```bash
git clone <your-repo-url> pdf-pro
cd pdf-pro
npm install
cp .env.example .env
npm start          # production
npm run dev         # with nodemon, auto-restart
```

The app serves both the frontend and API from a single Express server at `http://localhost:5000`.

## 📁 Folder structure

```
PDF-Pro/
├── index.html            # Homepage
├── all-tools.html         # Full tool directory
├── tools/                  # 16 individual tool workspace pages
├── assets/                 # icons, images, logos, fonts
├── css/                    # variables, style, navbar, hero, cards, upload, footer, animations, responsive
├── js/                     # utils, theme, toast, validation, dragdrop, upload, converter, animations, app
├── server/
│   ├── app.js              # Express entry point
│   ├── config/              # environment config
│   ├── routes/               # /api/pdf/* route definitions
│   ├── controllers/          # request handlers per tool
│   ├── services/              # pdf-lib / sharp / LibreOffice / qpdf logic
│   ├── middleware/             # multer upload config, error handler
│   └── utils/                  # filesystem helpers, cleanup job
├── uploads/, converted/, temp/  # working directories (auto-cleaned hourly)
└── package.json
```

## 🔒 Security

- File type validated by both extension and MIME type, client- and server-side
- 50MB per-file limit, 20 files per request
- Uploaded and generated files are deleted immediately after each response, with a background sweep as a safety net
- API rate limiting (200 requests / 15 min / IP by default)
- `helmet` for standard HTTP security headers

## 📈 Scaling this project

This is a genuinely working foundation, not a prototype shell — but a few things are worth knowing if you're taking it to production:

- **Compression** currently uses `pdf-lib`'s object-stream re-serialization, which shrinks most PDFs meaningfully but doesn't re-encode embedded photos. For deeper compression, pipe through Ghostscript (`gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook`) as an optional second pass.
- **OCR**: for scanned PDFs, add `tesseract.js` or a Tesseract CLI pass over the rasterized pages (the same pipeline used by PDF→JPG) to produce a searchable text layer before Word conversion.
- **Image extraction** reads embedded image streams directly from the PDF's object table — reliable for the vast majority of PDFs, but very unusual encodings may need a fallback path.
- For high-traffic deployments, move file processing into a queue (e.g. BullMQ + Redis) so large conversions don't block the request thread.

## 🗺️ Future improvements

- User accounts with conversion history
- Batch processing across multiple tools in one flow
- Real-time collaborative PDF annotation
- Tesseract-based OCR text layer for scanned documents
- Cloud storage integrations (Google Drive, Dropbox)

## 📄 License

MIT — free to use, modify, and deploy.
