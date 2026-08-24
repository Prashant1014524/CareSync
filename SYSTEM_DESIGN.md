# System Design Document: Healthcare Appointment Platform

## 1. Overview
The Healthcare Appointment & Follow-up Manager is an enterprise-grade platform built to solve healthcare scheduling friction, prevent double-booking race conditions, handle doctor leave conflicts seamlessly, and deliver reliable AI pre-visit and post-visit summaries.

---

## 2. Double-Booking & Race Condition Prevention
Simultaneous booking attempts by multiple patients for the exact same doctor slot present a classic distributed concurrency problem. CareSync solves this using a two-tier defense mechanism:

### Tier 1: Slot Hold Mechanism (Temporary TTL Reservation)
Before a patient enters the pre-visit symptom intake wizard, a temporary 5-minute slot hold is registered in the `SlotHold` table. 
- During these 5 minutes, other patients attempting to query or hold the slot are blocked (`409 Conflict`).
- Holds auto-expire via `expiresAt` timestamps, preventing deadlocks if a user abandons checkout.

### Tier 2: Atomic Database Transactions with Pessimistic/Optimistic Isolation
When the patient submits the symptom form to finalize booking, the backend executes an **Atomic Database Transaction** (`prisma.$transaction`):
1. **Re-Verification Lock**: The transaction re-queries the `Appointment` table for `(doctorId, startTime)` under strict database transaction isolation.
2. **Conflict Abort**: If another process committed a booking milliseconds earlier, the transaction detects the collision and throws a `DOUBLE_BOOKING_PREVENTED` error, rolling back all DB changes immediately.
3. **Unique Database Constraint**: The `Appointment` schema enforces a composite unique index (`@@unique([doctorId, startTime])`). Even if concurrent application threads bypass application logic, the database engine enforces physical uniqueness at the engine level.

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

- **State Initialization**: When a slot is tapped, a `SlotHold` row is created (`expiresAt = now() + 5 minutes`).
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
