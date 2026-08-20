# Nest Infra Developers — Real Estate CRM

## Original Problem Statement
Simple, professional Real Estate CRM for NEST INFRA DEVELOPERS. Mobile + desktop friendly, NOT a complicated ERP. Admin manages Projects, Agents, Teams, Commission Structure, Salary, Expenses, Sales, Payments — manual entry + Excel/CSV bulk upload with preview/errors/duplicates/confirmation. Auto-calculations for inventory, commission, balances, monthly accounts. Dashboard, reports (Excel/CSV/Print), role-based login (Admin sees all, Agent sees only own sales/commission/team/projects). Indian Rupee ₹. Hostinger-ready.

## Architecture
- **Backend**: FastAPI + MongoDB (motor), JWT Bearer auth (7-day tokens), bcrypt hashing
  - `server.py` — app wiring, startup seeding, indexes
  - `auth.py` — JWT login (email for admin / agent_code for agents), admin seed from env
  - `routers/masters.py` — projects, agents (auto-creates agent login), teams CRUD + dashboards
  - `routers/transactions.py` — commission rules, sales (auto inventory + commission + booking payment), payments (auto balance + status flip), salary, expenses
  - `routers/insights.py` — dashboard aggregation, monthly accounts summary, 9 reports with CSV/XLSX export
  - `routers/uploads.py` — Excel/CSV preview (errors + duplicates) + confirm import for all 8 entities
  - `seed.py` — sample data relative to current month
- **Frontend**: React + Tailwind + shadcn/ui + recharts, Outfit/IBM Plex fonts, emerald/slate theme
  - `pages/`: Login, Dashboard, Projects, Agents, Teams, Sales, Payments, Commission, Salary, Expenses, Accounts, Reports, Uploads (Admin)
  - `components/Layout.jsx` — responsive sidebar (hamburger on mobile), role-filtered nav

## User Personas
- **Admin** (nestinfradevelopers39@gmail.com): full access incl. salary, expenses, accounts, uploads
- **Agent** (e.g. NIA001 / nest@123): own sales, collections, commission, teams, projects only

## Implemented (2026-08-20)
- JWT login with dual identifier (admin email / agent ID) + change password
- Dashboard: inventory KPIs, monthly sales/collection/commission/salary/expenses/profit, 6-month bar chart, top agents/teams, recent sales/payments
- Projects with plot inventory counters, images, Google Maps link, auto counter updates on sale/payment/status change
- Agents CRUD + auto login creation + per-agent performance dashboard
- Teams CRUD with leader, members, monthly target & achievement bar
- Commission rules (percentage/fixed × agent/team_leader/project/team × sale value/collection), auto-calc on sale, pay agent/team commission tracking
- Sales entry → updates inventory, agent/team stats, commission; duplicate plot protection
- Payments → update balance, flip booked→sold at full payment
- Salary (net auto-calc) and Expenses (12 categories) with monthly totals
- Monthly Accounts summary with estimated profit
- 9 reports with CSV/Excel export + print view
- Admin bulk upload (8 entities) with preview, error & duplicate flagging, confirm — never deletes existing data
- Sample data seeded (3 projects, 9 agents, 3 teams, 14 sales, payments, salaries, expenses)

## Backlog
- P1: Edit full sale details (amounts) after creation (currently status/customer only)
- P1: Plot-level inventory map (visual plot grid per project)
- P2: Leads module (if needed later)
- P2: Payment receipts as printable PDF
- P2: Customer directory page

## Next Tasks
- User acceptance review, then deploy to Hostinger (build React, serve FastAPI via uvicorn/gunicorn behind nginx)
