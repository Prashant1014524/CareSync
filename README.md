# CareSync: Healthcare Appointment & Follow-up Platform

CareSync is a full-stack healthcare appointment and follow-up platform built with Node.js, Express, React (Vite), Tailwind CSS, Prisma ORM, and Google Gemini LLM. It provides separate portals for **Patients**, **Doctors**, and **Admins**, featuring double-booking prevention, 5-minute slot hold reservations, doctor leave conflict management, automated medication reminders, email notifications, and Google Calendar integration.

---

## 🚀 Demo Accounts (Pre-Seeded)

The application comes pre-populated with test accounts across all roles:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@clinic.com` | `admin123` | Full access to doctor profiles, rosters, analytics & email logs |
| **Doctor** | `dr.smith@clinic.com` | `doc123` | Cardiology specialist (Start: 09:00, End: 17:00) |
| **Doctor** | `dr.sarah@clinic.com` | `doc123` | Neurology specialist (Start: 10:00, End: 16:00) |
| **Patient** | `patient1@example.com` | `patient123` | John Doe |
| **Patient** | `patient2@example.com` | `patient123` | Jane Miller |

> 💡 **Quick Switcher**: Click the **Demo Roles** buttons in the top navbar to switch between Admin, Doctor, and Patient instantly without typing credentials!

---

## 📁 Repository Structure

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # Prisma ORM Database Schema (SQLite / Postgres)
│   ├── src/
│   │   ├── controllers/         # Auth, Admin, Doctor, Appointment, Leave, Reminder
│   │   ├── middleware/          # JWT auth & Centralized Error Handler
│   │   ├── routes/              # Express API Routes
│   │   ├── services/            # LLM (Gemini), Email, Google Calendar, Slot Hold, Leave
│   │   ├── index.js             # Express Server Entrypoint
│   │   ├── prisma.js            # Prisma Client Singleton
│   │   └── seed.js              # Database Seeder Script
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Navbar, PatientPortal, DoctorPortal, AdminPortal, AuthModal
│   │   ├── context/             # AuthContext (JWT & Demo Switcher)
│   │   ├── services/            # Axios API Client
│   │   ├── App.jsx              # Main App & Dashboard Switcher
│   │   └── main.jsx
│   └── package.json
├── SYSTEM_DESIGN.md            # Technical Write-up (Double-booking, Leave, Slot Hold, Retries)
├── README.md                   # Complete Platform Guide & Docs
├── .env.example                # Environment variables reference
└── create-zip.js               # Deliverable ZIP archive packager
```

---

## ⚙️ Quick Setup Guide

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### 1. Backend Setup
```bash
cd backend
npm install

# Push database schema & generate Prisma client
npx prisma db push

# Seed initial test accounts & sample appointments
node src/seed.js

# Start backend server (runs on http://localhost:5000)
npm run dev
```

### 2. Frontend Setup
```bash
cd ../frontend
npm install

# Start Vite React development server (runs on http://localhost:3000)
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## 🔑 Environment Variables Reference (`.env.example`)

Create a `.env` file inside `backend/`:

```env
PORT=5000
DATABASE_URL="file:./dev.db" # Or postgresql://user:password@localhost:5432/healthcaredb
JWT_SECRET="healthcare-jwt-secret-key-2026"

# Google Gemini LLM API Key (Get from https://aistudio.google.com/)
GEMINI_API_KEY="your-gemini-api-key-here"

# Email Configuration (Nodemailer)
# Leave SMTP_HOST empty for auto-generated Ethereal test account in dev console!
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="Healthcare App <no-reply@healthcareapp.com>"

# Google Calendar API OAuth 2.0 (Optional - fallback links used if unconfigured)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"
```

---

## 🤖 LLM Integration & Prompts Reference

The platform leverages **Google Gemini 1.5 Flash** for pre-visit and post-visit intelligence.

### 1. Pre-Visit Symptom Summary Prompt
```text
Analyse these symptoms and return a JSON object with:
1. "urgencyLevel": string (Must be strictly one of: "Low", "Medium", "High")
2. "chiefComplaint": string (A concise summary of the primary complaint)
3. "suggestedQuestions": string[] (Array of exactly three relevant questions for the doctor)

Patient Symptoms: <symptoms>
Duration: <duration>
Severity: <severity>
Medical History: <history>
```

### 2. Post-Visit Summary & Prescription Prompt
```text
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps.

Clinical Notes: <notes>
Diagnosis: <diagnosis>
Prescription & Treatment Plan: <prescription>
```

### 🛡️ Graceful Failure & Fallback Mechanism
If the Gemini API key is omitted, quota is exceeded, or parsing fails, the system executes an internal heuristic fallback parser. **The booking flow, appointment saving, and note submission will NEVER crash or block the user.**

---

## 📅 Google Calendar OAuth 2.0 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable **Google Calendar API**.
3. Create **OAuth 2.0 Client ID** credentials (Web Application).
4. Set Redirect URI: `http://localhost:5000/api/auth/google/callback`.
5. Obtain Refresh Token using Google OAuth Playground.
6. Populate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` in `.env`.
7. *Fallback Mode*: If credentials are not set, CareSync automatically generates Google Meet consultation links so calendar features work out-of-the-box.

---

## 🌐 API Endpoint Reference

### Auth Routes
- `POST /api/auth/register`: Register user (`PATIENT`, `DOCTOR`, `ADMIN`).
- `POST /api/auth/login`: Authenticate and return JWT token.
- `GET /api/auth/profile`: Fetch active user profile.

### Appointment Routes
- `GET /api/appointments/doctors/search`: Search doctors by specialization/query.
- `GET /api/appointments/doctors/:doctorId/slots?date=YYYY-MM-DD`: Get available slots, hold statuses, and leave info.
- `POST /api/appointments/hold-slot`: Reserve 5-minute temporary hold on slot.
- `POST /api/appointments/book`: Atomically book appointment with pre-visit AI summary.
- `GET /api/appointments/patient`: View patient appointments.
- `GET /api/appointments/doctor`: View doctor appointments with AI urgency levels.
- `POST /api/appointments/:appointmentId/post-visit`: Doctor submits clinical notes -> triggers LLM post-visit summary & medication reminders.

### Doctor Leave Routes
- `POST /api/leave/mark`: Mark doctor leave for date, automatically cancels affected bookings & notifies patients.
- `POST /api/leave/remove`: Remove doctor leave date.

---

## 🚢 Hosted Application & Deployment Guide

### Deploying Backend (Render / Railway / Supabase)
1. Push repo to GitHub.
2. Create a Web Service on **Render** pointing to `/backend`.
3. Set Build Command: `npm install && npx prisma db push && node src/seed.js`.
4. Set Start Command: `node src/index.js`.
5. Environment Variables: Add `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`.

### Deploying Frontend (Vercel / Netlify)
1. Import repo to **Vercel** pointing to `/frontend`.
2. Set Build Command: `npm run build`. Output directory: `dist`.
3. Environment Variable: `VITE_API_URL` = `https://your-backend-service.onrender.com/api`.

---

## 📦 Packaging Deliverable ZIP

To package the complete project into a deliverable zip file:
```bash
node create-zip.js
```
This generates `healthcare-appointment-manager.zip` in the root directory.
