CREATE TYPE "DoctorListingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "DoctorProfile"
  ADD COLUMN "listingStatus" "DoctorListingStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "registrationNumber" TEXT,
  ADD COLUMN "clinicName" TEXT,
  ADD COLUMN "clinicAddress" TEXT,
  ADD COLUMN "clinicCity" TEXT,
  ADD COLUMN "clinicPostalCode" TEXT;
