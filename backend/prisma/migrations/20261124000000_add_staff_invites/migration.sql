CREATE TABLE "StaffInvite" (
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("email"),
    CONSTRAINT "StaffInvite_role_check" CHECK ("role" IN ('DOCTOR', 'ADMIN')),
    CONSTRAINT "StaffInvite_createdById_fkey" FOREIGN KEY ("createdById")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
