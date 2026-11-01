# PautangTrack 📋
### Personal Lending & Debtors Management System (Svelte + Tailwind CSS + SQLite)

A modern, fast, and streamlined system built strictly for tracking **Pautang (Money Lent Out)** to family, friends, colleagues, and customers. The entire interface and data flow are in **English**.

Built with **Svelte**, **Tailwind CSS**, and a persistent **SQLite database**. The app requires account sign-in before showing the ledger.

## 🔐 Account & Offline Access

- The first sign-up creates the single account for this installation and opens the existing ledger; it does not erase existing records.
- Account creation requires an internet connection. Passwords are stored on the server as salted scrypt hashes.
- Sign in once while online on each device to enable later offline sign-in on that device. Offline changes remain in the browser's local IndexedDB queue and sync after an online sign-in.
- Sign out to return to the sign-in screen. Offline sign-in is available only on a device with a previously saved verifier.
- Use HTTPS for remote access so sign-in credentials and session tokens are protected in transit. Local development on `localhost` is supported.
- For hosted deployments, point `UTANG_DB_PATH` at a persistent mounted volume; an ephemeral container filesystem can lose online records when the service restarts or redeploys.

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
- **100% Local SQLite Database**: Saved at [`data/utang.sqlite`](file:///d:/Utang%20System/data/utang.sqlite).
- **Export to CSV**: Download complete records in Excel/Sheets-ready CSV format.
- **Sample Data Loader**: Preloaded with realistic sample records.
- **Reset All Data**: Clean wipe when you want to start fresh.

---

## 🚀 How to Run the Application

The system is compiled and running at:
👉 **[http://localhost:3000](http://localhost:3000)**

### Quick Commands

#### Start the Server:
```powershell
npm start
```

#### Run in Development Mode (Live Hot-Reload):
```powershell
npm run dev
```

#### Rebuild Frontend:
```powershell
npm run build
```

The database defaults to `data/utang.sqlite`. Set `UTANG_DB_PATH` to use a different SQLite file.
