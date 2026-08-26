# Firebase Setup Guide

PDF-Pro uses Firebase for two things:

1. **Authentication** — email/password sign up, log in, and password reset.
2. **Cloud Firestore** — one profile document per user at `users/{uid}`.

The frontend talks to Firebase directly using the **public web config**. The backend independently verifies the user's ID token using the **Firebase Admin service account** so that the 10 MB rule cannot be bypassed by calling the API directly.

You need to complete every step below once. It takes about 10–15 minutes.

---

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Give it a name (for example `pdf-pro`) and continue.
3. Google Analytics is optional and not used by PDF-Pro — you can turn it off.
4. Wait for the project to be created, then open it.

---

## 2. Enable Email/Password authentication

1. In the left sidebar, open **Build → Authentication**.
2. Click **Get started**.
3. Open the **Sign-in method** tab.
4. Click **Email/Password**, toggle **Enable** on, and **Save**.

Leave "Email link (passwordless sign-in)" **off** — PDF-Pro uses classic email + password.

---

## 3. Create the Firestore database

1. In the left sidebar, open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode** (not test mode). PDF-Pro ships its own security rules.
4. Pick a location close to your users and click **Enable**.

You do **not** need to create the `users` collection by hand — it is created automatically the first time someone signs up.

---

## 4. Publish the security rules

The repository contains `firestore.rules`. These rules ensure a signed-in user can only read and write **their own** profile document, and that every other path is denied.

The easiest way to publish them:

1. In **Firestore Database**, open the **Rules** tab.
2. Delete whatever is there and paste the entire contents of `firestore.rules` from the repository.
3. Click **Publish**.

What the rules enforce:

- A user may read `users/{uid}` only when `request.auth.uid == uid`.
- A user may create or update `users/{uid}` only for their own uid, and only with the fields `email`, `displayName`, `createdAt`, `lastLoginAt`.
- Nobody can delete profile documents from the client.
- Every other collection and document is denied by default.

(If you use the Firebase CLI instead, `firebase deploy --only firestore:rules` will pick up `firestore.rules` automatically.)

---

## 5. Get the public web config (for the frontend)

1. Open **Project settings** (the gear icon, top-left) → **General** tab.
2. Scroll to **Your apps** and click the **Web** icon (`</>`).
3. Register the app with any nickname (for example `pdf-pro-web`). You do **not** need Firebase Hosting.
4. Firebase shows a `firebaseConfig` object. Copy those six values.
5. Open `js/firebase-config.js` in the repository and replace the placeholders:

```js
window.PDF_PRO_FIREBASE_CONFIG = {
  apiKey: 'AIza...your real key...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:0000...:web:abcd...',
};
```

These values are **public by design** — they are safe to commit and ship to the browser. Firebase security comes from the rules you published in step 4, not from hiding this config. Access is still restricted to the domains you authorize in the next step.

---

## 6. Authorize your domains

1. Back in **Authentication → Settings → Authorized domains**.
2. `localhost` is already there for local testing.
3. Click **Add domain** and add your production frontend domain, for example `pdf-pro.vercel.app` (and any custom domain you use).

Sign-in requests from domains that are not on this list are rejected by Firebase.

---

## 7. Create the Admin service account (for the backend)

The backend needs a service account so it can verify ID tokens. This is a **secret** and must never be committed or shipped to the browser.

1. Open **Project settings → Service accounts**.
2. Click **Generate new private key**, then **Generate key**. A JSON file downloads.
3. Open that JSON file. You need three values from it: `project_id`, `client_email`, and `private_key`.

You will paste these into the backend's environment variables in Render (see `docs/DEPLOYMENT.md`). PDF-Pro accepts them in either of two forms:

**Option A — three separate variables (recommended):**

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
```

When you paste the private key as a single line, keep the literal `\n` sequences — the backend converts them back into real newlines automatically.

**Option B — the whole JSON in one variable:**

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...", ... }
```

Use one option or the other, not both. If both are present, `FIREBASE_SERVICE_ACCOUNT` wins.

---

## 8. Verify it works

Once the frontend config is filled in and the backend has the service account variables:

- Open the site, click **Log in → Create account**, and register. You should be redirected to your account page.
- In the Firebase console under **Authentication → Users**, your new account appears.
- Under **Firestore Database → Data**, a `users/{uid}` document appears with `email`, `displayName`, `createdAt`, and `lastLoginAt`.
- The backend health check at `/api/health` reports `"authConfigured": true`.

If `authConfigured` is `false`, the backend cannot see the service account — recheck the environment variables in Render.

---

## What happens if Firebase is not configured

PDF-Pro is designed to keep working even before you add Firebase:

- The frontend detects the placeholder config and simply hides account features. All 16 tools still work for files under the guest limit.
- The backend detects the missing service account and rejects any upload above the guest limit with a clear message, rather than letting large files through unauthenticated. This is a deliberate fail-closed behavior.
