# 🏢 NEST INFRA DEVELOPERS — Enterprise Real Estate CRM

[![Powered by](https://img.shields.io/badge/Powered%20By-MerlinFlow%20Technologies%20Pvt.%20Ltd.-10B981?style=for-the-badge)](https://crm.nestinfradevelopers.in)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TailwindCSS-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas%20Cloud-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/atlas)

A complete, high-performance Cloud CRM platform engineered specifically for open plot developers, real estate ventures, and land colonizers. Built from the ground up to manage real estate ventures, color-coded interactive plot layouts, field sales agents, multi-tier team commission distributions, leads pipeline, and GST-compliant payment receipts.

---

## 🌐 Live Production Deployment

| Service | Environment / URL | Hosted On |
| :--- | :--- | :--- |
| **CRM Web Portal** | [https://crm.nestinfradevelopers.in](https://crm.nestinfradevelopers.in) | **Vercel** |
| **Backup Domain** | [https://nest-infra-developers.vercel.app](https://nest-infra-developers.vercel.app) | **Vercel** |
| **REST API Engine** | [https://nest-infra-crm-api.onrender.com](https://nest-infra-crm-api.onrender.com) | **Render** |
| **Database Cluster** | `ap-south-1 Mumbai` (Cloud Atlas) | **MongoDB Atlas** |
| **DNS & Domain** | `nestinfradevelopers.in` | **Hostinger** |

---

## 🌟 Core Enterprise Features

### 🗺️ 1. Interactive Plot Matrix & Venture Layouts
* **Live Status Matrix**: Real-time visual color-coding for all plots:
  * 🟢 **Available** — Ready for booking with square yard rate & facing.
  * 🟡 **Booked** — Locked with advance token payment details.
  * 🔴 **Sold** — Registered and assigned to verified buyer.
* **Filter & Search**: Instantly filter plots by Facing (East/West/North/South), Size, Status, and Plot Number.
* **Instant Plot Detail Modal**: View plot size (sq. yds), price per sq. yd, total price, buyer information, and assigned agent.

### 👤 2. Role-Based Access Control (Admin vs. Field Agent)
* **Master Admin Dashboard**:
  * Real-time metrics on total revenue, monthly collections, pending balances, top-performing agents, and team rankings.
  * Complete financial ledger: salary payouts, business expenses, and net profit calculations.
* **Restricted Field Agent Portal**:
  * Dedicated restricted view showing only the agent's assigned sales, customer leads, and earned commission balances.
  * Zero visibility into company profit, salary expenses, or other agents' private commissions.

### 🔒 3. Agent 1-Time Password Security & Management Lock
* Admin issues initial agent accounts with a common onboarding password (e.g. `nest@123`).
* On first login, the agent has **strictly 1-time access** to configure their private password.
* Once saved, the system permanently locks password changes (`password_changed: True`).
* Any further password resets or profile corrections display the official **Domain Management Helpdesk** (`admin@nestinfradevelopers.in` / `+91 98480 12345`).

### 👥 4. Multi-Tier Agent & Team Commission Engine
* Automated commission calculations based on assigned commission plans (e.g. Standard 2%, Senior 3%, Executive 5%).
* Multi-level hierarchy tracking: Direct Sales Agent, Sponsoring Agent, and Team Leader overrides.
* Real-time commission ledger with payment tracking and pending balance reconciliations.

### 📋 5. Leads & Site Visits Pipeline
* Comprehensive Kanban / Tabular lead management tracking: *New Inquiry ➔ Follow-up ➔ Site Visit Scheduled ➔ Site Visit Completed ➔ Token Paid ➔ Sale Closed*.
* Track lead sources (Website, Referral, Social Media, Walk-in) and assign directly to field associates.

### 🧾 6. Official GST-Ready Payment Receipts & Vouchers
* Generates professional printable payment receipts for every token advance or installment payment.
* Includes dynamic company details (Legal Name, GSTIN, RERA ID, Bank Account/IFSC), buyer info, plot details, payment mode, and authorized signatory voucher stamp.
* Clean print styling optimized for direct A4 thermal or desktop printing and PDF downloads.

### 🎛️ 7. Enterprise Admin Control Center & Master Hub
* **Venture Setup**: 1-click bulk plot generator with square yard formulas, corner plot premiums, and facing rules.
* **Company Branding**: Customize legal trade name, RERA registration number, GSTIN, bank details, and invoice terms.
* **Data Management**: Controlled factory purge and data reset tools protected by authorization phrases.

---

## 🛠️ Technology Stack

```
NestInfraDevelopers/
├── frontend/             # React 18 SPA (TailwindCSS, Radix UI, Recharts, Lucide)
├── backend/              # FastAPI Python 3.11 Async Backend (Motor, JWT, Bcrypt)
└── DEPLOYMENT_GUIDE.md   # Cloud Deployment & DNS Architecture Reference
```

* **Frontend**:
  * React 18, React Router v6, Tailwind CSS
  * Radix UI Dialogs & Sheet Drawers
  * Recharts Data Visualization
  * Lucide Enterprise Icons
  * Axios Authenticated Interceptors
* **Backend**:
  * Python 3.11, FastAPI (ASGI)
  * Motor (AsyncIO MongoDB Driver)
  * PyJWT (Token Authentication)
  * Passlib / Bcrypt Password Hashing
  * Uvicorn Production Web Server
* **Database**:
  * MongoDB Atlas Cloud (Replica Set in `ap-south-1 Mumbai`)

---

## 🚀 Local Development Setup

### 1. Prerequisites
* **Node.js**: v18.0 or higher
* **Python**: v3.10 or v3.11
* **MongoDB**: Local MongoDB instance or Atlas connection string

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start local backend server (runs on http://localhost:8000)
uvicorn server:app --reload --port 8000
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
yarn install

# Start local React development server (runs on http://localhost:3000)
yarn start
```

---

## 🔑 Default Credentials

| Role | Login Identifier | Default Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Master Admin** | `nestinfradevelopers39@gmail.com` | `Admin@123` | Full Master Superadmin Access |
| **Sample Agent** | `NIA001` | `nest@123` | Field Agent Associate Portal |

---

## 🏢 Corporate Attribution & License

```
Designed, Engineered & Powered by:
MerlinFlow Technologies Pvt. Ltd.
All rights reserved © 2026 Nest Infra Developers.
```

For support, software modifications, or custom feature requests, please contact **MerlinFlow Technologies Pvt. Ltd.**
