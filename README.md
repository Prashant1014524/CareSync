# CareSync: Healthcare Appointment & Follow-up Platform (Production-Grade)

CareSync is an enterprise-grade full-stack healthcare appointment and follow-up platform built with **Node.js, Express, React (Vite), Tailwind CSS, Prisma ORM, Neon Serverless PostgreSQL, and Google Gemini LLM**. It delivers dedicated role-based portals for **Patients**, **Doctors**, and **Admins**, featuring double-booking concurrency locks, 5-minute slot hold reservations, doctor leave automated conflict resolution, AI pre/post visit summaries, automated medication reminders, and Google Calendar / Email synchronization.

---

## ⚡ High-Performance Tech Stack
- **Database**: **Neon Serverless PostgreSQL** (SSL encrypted, auto-scaling connection pooling, zero-maintenance)
- **ORM**: **Prisma ORM** with PostgreSQL schema, `@db.Text` type optimizations, and idempotent migrations
- **Backend API**: Node.js & Express with **Helmet** security headers, strict CORS, rate-limiting, and deep `/api/health` DB ping checks
- **AI Intelligence**: **Google Gemini 1.5 Flash** with resilient heuristic fallback parsing
- **Background Jobs**: **Node-Cron** automated background worker for medication reminders and email retry queues
- **Frontend**: **React 18 + Vite** with Tailwind CSS, Lucide icons, and role-based dashboards
- **Deployment**: Render (Backend Web Service) + Vercel (Frontend Global CDN)

---

## 🚀 Demo Accounts (Pre-Seeded)

The local demo seed creates these accounts. Run it only against a disposable development database.

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@clinic.com` | `admin123` | Full access to doctor profiles, rosters, analytics & email logs |
| **Doctor** | `dr.smith@clinic.com` | `doc123` | Cardiology specialist (Start: 09:00, End: 17:00) |
| **Doctor** | `dr.sarah@clinic.com` | `doc123` | Neurology specialist (Start: 10:00, End: 16:00) |
| **Patient** | `patient1@example.com` | `patient123` | John Doe |
| **Patient** | `patient2@example.com` | `patient123` | Jane Miller |

Use **Sign In** to enter the test account credentials manually when working with the local demo seed.

### Staff registration

Create the first administrator with `npm run admin:create` in `backend`. In the admin dashboard, use **Invite clinic staff** to choose **Doctor** or **Administrator** and enter the recipient's email. Share the private link with that person. They can open it or paste its code into **Sign Up → Staff Sign Up**, then set their own password. Links expire after 24 hours and work once. Issuing another invitation for the same email replaces the previous link.

### Doctor practice listings

Doctors can select **List your practice** on the homepage and submit their specialty, medical registration number, clinic address, and visit fee. An admin reviews the application under **Practice applications**. A doctor can sign in and track the application. Patients can find and book approved practices by name, specialty, city, or PIN code, and the booking displays the clinic address. Medical registration numbers are available to the applicant and admin for review.

---

## 📁 Repository Structure

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # Prisma ORM PostgreSQL schema
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
│   │   ├── context/             # AuthContext (JWT session)
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
- Node.js 24 and npm
- A disposable PostgreSQL database for local development

### 1. Backend Setup
```bash
cd backend
npm ci

# Copy backend/.env.example to backend/.env and fill in both PostgreSQL URLs first.
npm run build
npm run prisma:deploy

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
DATABASE_URL="postgresql://caresync:local_password@localhost:5432/caresync"
DIRECT_URL="postgresql://caresync:local_password@localhost:5432/caresync"
JWT_SECRET="" # Set a unique secret of at least 32 characters for production

# Google Gemini LLM API Key (Get from https://aistudio.google.com/)
GEMINI_API_KEY="your-gemini-api-key-here"

# Email Configuration (Nodemailer)
# Set true to disable delivery in the public demo.
EMAIL_DISABLED=false
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

### Deploy CareSync on free plans

1. Create a fresh **Neon Free** PostgreSQL database in Singapore to match the Render region. Keep its pooled and direct connection strings in your password manager. Use synthetic data for the hosted demo.
2. Import the GitHub release branch into **Vercel Hobby** and set the root directory to `frontend`. Copy the assigned Vercel origin. The committed Vercel configuration sets the build and output directory.
3. Import the same branch as a **Render Blueprint** using `render.yaml`. Enter the pooled Neon URL in `DATABASE_URL`, the direct URL in `DIRECT_URL`, and the exact Vercel origin without a trailing slash in `FRONTEND_URL`. Render generates `JWT_SECRET`. The build applies the checked-in migration to Neon. For a database already created with `prisma db push`, use a fresh database for the demo or baseline the existing schema before deploying.
4. Set `VITE_API_URL` in Vercel to the Render HTTPS URL followed by `/api`, then redeploy the frontend. Verify the API's `/api/health` returns HTTP 200 and reports a connected database.
5. From `backend`, run `npm run admin:create` once with `DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` set privately in your local shell or ignored `.env` file. Use a unique password of at least 16 characters and at most 72 bytes. Sign in as that administrator, create a fictional doctor, and book a slot from a separate patient account.

Render's free API sleeps after idle periods. Allow for its first-request delay during the demo. Email delivery is disabled in the Blueprint. Booking uses PostgreSQL, so confirmed appointments persist across API restarts.

Run `npm test` inside `backend` to check the registration API regression test locally.

### Welcome emails

CareSync sends a welcome email when a patient creates an account with a password or Google. In Resend, verify a sending domain and create a sending API key. Set `RESEND_API_KEY` and `WELCOME_EMAIL_FROM` on the backend. Use a sender such as `CareSync <welcome@mail.your-domain.example>` with your verified domain. The welcome email uses HTTPS on free Render and works independently of the SMTP settings for other notifications. New signups send once per account, with retries recorded in the existing email logs. Existing accounts signing in again do not trigger a welcome email.

### Google sign-in, Redis, and test checkout

- **Google sign-in.** Create a Web application OAuth client in Google Cloud. Add `http://localhost:3000` and your deployed Vercel origin to its authorized JavaScript origins. Put the client ID in `GOOGLE_SIGN_IN_CLIENT_ID` on the API and in `VITE_GOOGLE_SIGN_IN_CLIENT_ID` on the frontend, then rebuild the frontend. The same button signs up new patients or signs them back in. Existing password accounts keep their original sign-in method.
- **Redis.** The Render Blueprint creates a private free Key Value instance and sets the API's `REDIS_URL`. For local development, set `REDIS_URL=redis://127.0.0.1:6379` if you run Redis locally. The API uses Redis for rate-limit counters and uses a per-process store when the URL is unset. PostgreSQL retains patient, appointment, and payment records.
- **Razorpay test checkout.** Add `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to the API environment. Configure the same webhook secret in Razorpay and subscribe to `payment_link.paid`, `payment_link.expired`, and `payment_link.cancelled` at `https://your-api.onrender.com/api/payments/razorpay/webhook`. Use the hosted standard Payment Link and the test methods available in your Razorpay account. The fee is stored in paise and comes from the doctor's profile. Pending checkout holds the slot for up to 20 minutes plus any delay in verifying expiry. For cancelled test bookings, review the transaction in the Razorpay test dashboard. Test keys only are accepted.
- Apply the checked-in migrations with `npm run prisma:deploy` in `backend`. Run `npm run typecheck` to check the new TypeScript services. The backend uses Node.js 24 to load TypeScript modules.

---

## 📦 Packaging Deliverable ZIP

To package the complete project into a deliverable zip file:
```bash
node create-zip.js
```
This generates `healthcare-appointment-manager.zip` in the root directory.
