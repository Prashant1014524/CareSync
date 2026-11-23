CREATE TABLE "BookingPayment" (
    "appointmentId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "razorpayLinkId" TEXT,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("appointmentId"),
    CONSTRAINT "BookingPayment_appointmentId_fkey" FOREIGN KEY ("appointmentId")
      REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BookingPayment_razorpayLinkId_key" ON "BookingPayment"("razorpayLinkId");
CREATE INDEX "BookingPayment_expiresAt_idx" ON "BookingPayment"("expiresAt");
CREATE INDEX "Appointment_doctorId_startTime_idx" ON "Appointment"("doctorId", "startTime");
CREATE UNIQUE INDEX "Appointment_occupied_slot_key" ON "Appointment"("doctorId", "startTime")
  WHERE "status" IN ('BOOKED', 'COMPLETED', 'PAYMENT_PENDING');
DROP INDEX "Appointment_doctorId_startTime_key";
