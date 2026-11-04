# PautangTrack 📋

Personal lending and borrower management built with Svelte and Tailwind CSS.

## Storage and profiles

- The app is hosted online, but it does not use a cloud database.
- Each profile and its ledger are stored in the browser's IndexedDB on that device.
- Creating a profile and signing in require an internet connection. Once signed in, the saved ledger works offline.
- Profiles are device-only labels with a locally stored password verifier; they are not server accounts and do not encrypt the ledger. Anyone with access to the browser or device may be able to access its site data.
- Data does not sync to another browser or device. Clearing browser/site data can permanently delete profiles and ledgers. Download CSV backups regularly from Settings.
- Exported CSV files contain sensitive financial and contact information. Store backups securely.

## Run locally

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**. The production server can be run with:

```powershell
npm run build
npm start
```

## Deploy to Render

The included [`render.yaml`](./render.yaml) deploys a free Node web service. It does not create a database or require a `DATABASE_URL`. Push the repository to GitHub, then create a Render Blueprint from the repository. The browser stores each user's data locally, so Render restarts do not affect saved ledgers.

If you previously used a cloud database, those records are not automatically copied into browser storage. Export them before removing that database if you still need them.
