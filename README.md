# PautangTrack 📋
### Personal Lending & Debtors Management System (Svelte + Tailwind CSS + PostgreSQL)

A modern, fast, and streamlined system built strictly for tracking **Pautang (Money Lent Out)** to family, friends, colleagues, and customers. The entire interface and data flow are in **English**.

Built with **Svelte**, **Tailwind CSS**, and a PostgreSQL database. The app requires account sign-in before showing the ledger.

## 🔐 Account & Offline Access

- The first sign-up creates the single account for this installation and opens the existing ledger; it does not erase existing records.
- Account creation requires an internet connection. Passwords are stored on the server as salted scrypt hashes.
- Sign in once while online on each device to enable later offline sign-in on that device. Offline changes remain in the browser's local IndexedDB queue and sync after an online sign-in.
- Sign out to return to the sign-in screen. Offline sign-in is available only on a device with a previously saved verifier.
- Use HTTPS for remote access so sign-in credentials and session tokens are protected in transit. Local development on `localhost` is supported.
- Hosted deployments use PostgreSQL so ledger data survives application restarts and redeploys.

---

## ✨ Features

### 1. Pautang-Only Tracking (Money Lent Out)
- Dedicated solely to tracking money you lent out to others (no confusion with debts you owe).
- Track loan amount (₱ PHP), date lent, target due date, purpose/description, and custom agreements.
- Live status indicators: **Active (Unpaid)**, **Partially Paid**, **Paid in Full**, **Overdue**, and **Forgiven**.

### 2. Live Dashboard Analytics
- **Total Outstanding Balance**: Exact amount currently owed to you across all active borrowers.
- **Total Collected**: Lifetime repayments received.
- **Total Amount Lent**: Cumulative principal lent out to date.
- **Collected This Month**: Inflow repayments received in the current month.
- **Overdue Alert Banner**: Automatically highlights loans that passed their agreed due dates.

### 3. Borrowers Directory (Contacts)
- Manage your borrowers with nicknames, phone numbers, and relationship tags (*Family, Friend, Colleague, Customer, Neighbor*).
- Consolidated profile for each borrower showing their lifetime loans, repayments, and current outstanding balance.

### 4. Partial Repayments & Settlement
- Log partial or full repayments anytime.
- Tag by payment method: **Cash, GCash, Maya, Bank Transfer, Other**.
- Save transaction reference numbers (e.g. GCash Ref No.) and notes.
- Automatic balance reduction and progress bar tracking.
- **Celebration Confetti effect** when a loan is fully settled!
- **Forgive Loan Option**: Forwrite-offs or personal forgiveness.

### 5. Smart Payment Reminder Generator
Generate polished payment reminders in one click:
- **Friendly & Gentle Tone**: Polite reminder ideal for relatives and elders.
- **Casual Tone**: Relaxed message for friends and peers.
- **Short SMS Tone**: Direct message with remaining balance and target date.
- **Formal Tone**: Professional message for workplace or business loans.
- **One-Click Copy to Clipboard** and direct **SMS Launcher** (`sms:...`).

### 6. Statement of Account (Printable Slip / SOA)
- Generates an official **Statement of Account & Loan Acknowledgment Slip**.
- Itemized payment breakdown table with remaining balance due.
- Formal signature lines for both Lender (Creditor) and Borrower (Debtor).
- Print or save to PDF in one click (`window.print()`).

### 7. Data Management & Excel/CSV Export
- **PostgreSQL Database**: The server uses the `DATABASE_URL` connection string; SQLite remains available as the source for one-time imports.
- **Export to CSV**: Download complete records in Excel/Sheets-ready CSV format.
- **Sample Data Loader**: Preloaded with realistic sample records.
- **Reset All Data**: Clean wipe when you want to start fresh.

---

## 🚀 How to Run the Application

### Run Locally

The server requires PostgreSQL. Set `DATABASE_URL` to a reachable PostgreSQL database before starting the development or production server.

#### Development server (Vite):
```powershell
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/pautangtrack"
npm run dev
```

Open **http://localhost:5173**. For production mode, build the frontend and then start the Express server:
```powershell
npm run build
npm start
```

The production server listens on port `3000` by default.

## Deploy to Render

The included [`render.yaml`](./render.yaml) creates a Render web service and a managed PostgreSQL database. The configured web service and database use paid plans; this avoids the data loss risks of an ephemeral free web-service filesystem and expiring free database.

1. Push this repository to GitHub and create a Render account.
2. In Render, choose **New → Blueprint**, connect the repository, and deploy the `render.yaml` blueprint. Render provides `DATABASE_URL` to the app without putting credentials in source control.
3. If you have existing local records, import them before creating an account or adding cloud records. In Render’s database settings, copy its **external** connection string and run the following in PowerShell from the repository root:

   ```powershell
   $env:DATABASE_URL = "your-render-external-database-connection-string"
   $env:NODE_ENV = "production"
   node scripts/import-sqlite-to-postgres.js
   ```

   The importer reads `data/utang.sqlite` (or the file named by `UTANG_DB_PATH`) and stops if any destination table already contains records. It imports the existing account and session records as well as borrowers, loans, payments, and pending offline-operation records. Keep the connection string private and do not commit it.
4. Open the Render service URL and sign in with the imported account. For a fresh install with no imported account, create the first account in the app.

To run the importer against another PostgreSQL provider, set `DATABASE_URL` to that provider’s connection string. Never expose the database URL in browser code or commit it to the repository.
