# System Design Document: Healthcare Appointment Platform

## 1. Overview
The Healthcare Appointment & Follow-up Manager is an enterprise-grade platform built to solve healthcare scheduling friction, prevent double-booking race conditions, handle doctor leave conflicts seamlessly, and deliver reliable AI pre-visit and post-visit summaries.

---

## 2. Double-Booking & Race Condition Prevention
Simultaneous booking attempts by multiple patients for the exact same doctor slot present a classic distributed concurrency problem. CareSync solves this using a two-tier defense mechanism:

### Tier 1: Slot Hold Mechanism (Temporary TTL Reservation)
Before a patient enters the pre-visit symptom intake wizard, a temporary 5-minute slot hold is registered in the `SlotHold` table. The database enforces one row per `(doctorId, slotStartTime)`, so simultaneous hold requests cannot both succeed. Expired rows are removed before a slot is reclaimed; competing requests receive `409 Conflict`.

### Tier 2: Atomic Database Transactions with Pessimistic/Optimistic Isolation
When the patient submits the symptom form to finalize booking, the backend executes an **Atomic Database Transaction** (`prisma.$transaction`):
1. **Re-Verification Lock**: The transaction re-queries the `Appointment` table for `(doctorId, startTime)` under strict database transaction isolation.
2. **Conflict Abort**: If another process committed a booking milliseconds earlier, the transaction detects the collision and throws a `DOUBLE_BOOKING_PREVENTED` error, rolling back all DB changes immediately.
3. **Partial Unique Database Constraint**: PostgreSQL enforces one occupying appointment (`BOOKED`, `COMPLETED`, or `PAYMENT_PENDING`) per `(doctorId, startTime)`. Cancelled and expired appointments do not block future bookings.

---

## 2.1 Clinic Locations, Distance, and Branch Schedules

- `Clinic` stores a practice address, optional latitude/longitude, and an IANA time-zone name. Existing doctor listings are migrated into a clinic record without requiring new credentials.
- `DoctorClinic` links a doctor to a clinic and stores that branch's working days, local opening/closing hours, appointment length, and consultation fee.
- A doctor can add and update branches from the doctor portal. A patient can grant browser location access to request nearby ordering; the API computes Haversine distance in kilometers and sorts clinics by nearest first. Without coordinates or consent, normal text search remains available.
- The selected clinic ID is sent through slot lookup, hold, and booking. Schedule validation converts clinic wall-clock hours to UTC instants using the clinic time zone. Appointment records retain the chosen clinic so both patient and doctor portals show where the visit will occur.
- The booking uniqueness constraint remains doctor-and-time based: one doctor cannot be booked at two branches at the same instant.

---

## 3. Doctor Leave Conflict Handling
When an Admin or Doctor marks a date as leave (`YYYY-MM-DD`), the platform executes an automated cascade workflow:

1. **Leave Registration**: A `DoctorLeave` record is created for `(doctorId, leaveDate)`.
2. **Impact Analysis**: The system queries all existing `BOOKED` appointments falling within `00:00:00` to `23:59:59` UTC of the target date.
3. **Automated Cancellation**: Affected appointments are updated to `CANCELLED` status with `cancelReason = "Doctor on leave: <reason>"`.
4. **Google Calendar Synchronization**: The system calls `deleteCalendarEvent(googleEventId)` to remove calendar entries for both doctor and patient calendars.
5. **Patient Notification Dispatch**: The notification worker dispatches personalized cancellation HTML emails to all affected patients, containing direct links to re-book alternative slots.

---

## 4. Slot Hold Mechanism & Expiry Architecture
The slot reservation lifecycle prevents inventory hoarding while offering patients time to complete symptom intake:

- **State Initialization**: When a slot is tapped, a `SlotHold` row is created (`expiresAt = now() + 5 minutes`). A unique database index allows only one hold per doctor and slot, including across multiple API instances.
- **Dynamic Slot Availability Query**: When querying available slots, the application filters out slots where `expiresAt > now()` and `patientId != requestingUser`.
- **Background & Passive Cleanup**: Expired holds are purged both passively during slot lookup queries and actively by the 1-minute `node-cron` background worker.

---

## 5. Notification Failure & Retry Architecture
Email delivery failures (rate-limits, network timeouts, SMTP errors) can cause critical missed appointments. CareSync uses an asynchronous Dead Letter & Retry Pattern:

```
[Trigger Event] ---> [Email Service] ---> Succeeded? ---> Log "SENT" in EmailLog
                                 |
                                 v (No / Failure)
                         Log "FAILED" in EmailLog
                                 |
                                 v
                     [node-cron Background Retry]
                                 |
                      Retry (Max 3 Attempts)
```

1. **Transactional Email Logging**: Every email (Booking Confirmation, Reminder, Cancellation, Medication Alert) is initially written to the `EmailLog` table.
2. **Asynchronous Background Retries**: The `node-cron` worker scans `EmailLog` every 60 seconds for records where `status = "FAILED"` and `retryCount < 3`.
3. **Exponential Backoff**: Retries are attempted with backoff intervals. If all retries fail, the status is flagged as unrecoverable for administrator auditing in the Admin Portal.
