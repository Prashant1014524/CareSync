CREATE TABLE "Clinic" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Clinic_coordinate_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  CONSTRAINT "Clinic_latitude_check" CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
  CONSTRAINT "Clinic_longitude_check" CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180))
);

CREATE TABLE "DoctorClinic" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "startHour" TEXT NOT NULL DEFAULT '09:00',
  "endHour" TEXT NOT NULL DEFAULT '17:00',
  "slotDurationMinutes" INTEGER NOT NULL DEFAULT 30,
  "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
  "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoctorClinic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorClinic_slot_duration_check" CHECK ("slotDurationMinutes" BETWEEN 5 AND 240),
  CONSTRAINT "DoctorClinic_fee_check" CHECK ("consultationFee" >= 0)
);

ALTER TABLE "Appointment" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "SlotHold" ADD COLUMN "clinicId" TEXT;

-- Convert existing single-clinic doctor listings to normalized clinic records.
WITH clinic_seed AS (
  SELECT dp."userId" AS "doctorId", dp."clinicName" AS "name", dp."clinicAddress" AS "address",
         dp."clinicCity" AS "city", dp."clinicPostalCode" AS "postalCode",
         dp."startHour", dp."endHour", dp."slotDurationMinutes", dp."consultationFee",
         gen_random_uuid()::text AS "clinicId"
  FROM "DoctorProfile" dp
  WHERE NULLIF(TRIM(dp."clinicName"), '') IS NOT NULL
    AND NULLIF(TRIM(dp."clinicAddress"), '') IS NOT NULL
    AND NULLIF(TRIM(dp."clinicCity"), '') IS NOT NULL
    AND NULLIF(TRIM(dp."clinicPostalCode"), '') IS NOT NULL
), inserted_clinics AS (
  INSERT INTO "Clinic" ("id", "name", "address", "city", "postalCode", "updatedAt")
  SELECT "clinicId", "name", "address", "city", "postalCode", CURRENT_TIMESTAMP FROM clinic_seed
  RETURNING "id"
)
INSERT INTO "DoctorClinic" (
  "id", "doctorId", "clinicId", "startHour", "endHour", "slotDurationMinutes", "consultationFee", "weekdays", "updatedAt"
)
SELECT gen_random_uuid()::text, clinic_seed."doctorId", clinic_seed."clinicId", clinic_seed."startHour",
       clinic_seed."endHour", clinic_seed."slotDurationMinutes", clinic_seed."consultationFee",
       ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[], CURRENT_TIMESTAMP
FROM clinic_seed
JOIN inserted_clinics ON inserted_clinics."id" = clinic_seed."clinicId";

UPDATE "Appointment" AS appointment
SET "clinicId" = (
  SELECT "clinicId" FROM "DoctorClinic" WHERE "doctorId" = appointment."doctorId" ORDER BY "createdAt", "id" LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM "DoctorClinic" WHERE "doctorId" = appointment."doctorId");

UPDATE "SlotHold" AS hold
SET "clinicId" = (
  SELECT "clinicId" FROM "DoctorClinic" WHERE "doctorId" = hold."doctorId" ORDER BY "createdAt", "id" LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM "DoctorClinic" WHERE "doctorId" = hold."doctorId");

CREATE UNIQUE INDEX "DoctorClinic_doctorId_clinicId_key" ON "DoctorClinic"("doctorId", "clinicId");
CREATE INDEX "DoctorClinic_clinicId_idx" ON "DoctorClinic"("clinicId");
CREATE INDEX "Clinic_city_idx" ON "Clinic"("city");
CREATE INDEX "Clinic_postalCode_idx" ON "Clinic"("postalCode");
CREATE INDEX "Appointment_clinicId_idx" ON "Appointment"("clinicId");
CREATE INDEX "SlotHold_clinicId_idx" ON "SlotHold"("clinicId");

ALTER TABLE "DoctorClinic" ADD CONSTRAINT "DoctorClinic_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoctorClinic" ADD CONSTRAINT "DoctorClinic_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SlotHold" ADD CONSTRAINT "SlotHold_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
