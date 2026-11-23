-- Older versions could create duplicate active holds during concurrent requests.
-- Keep the newest live hold (or newest expired hold if none are live) per slot.
WITH ranked_holds AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "doctorId", "slotStartTime"
           ORDER BY ("expiresAt" > CURRENT_TIMESTAMP) DESC, "createdAt" DESC, "id" DESC
         ) AS position
  FROM "SlotHold"
)
DELETE FROM "SlotHold" AS hold
USING ranked_holds
WHERE hold."id" = ranked_holds."id"
  AND ranked_holds.position > 1;

DROP INDEX IF EXISTS "SlotHold_doctorId_slotStartTime_idx";
CREATE UNIQUE INDEX "SlotHold_doctorId_slotStartTime_key"
  ON "SlotHold"("doctorId", "slotStartTime");
