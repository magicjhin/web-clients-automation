-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('not_requested', 'queued', 'running', 'done', 'failed');

-- AlterTable
ALTER TABLE "lead_delivery" ADD COLUMN     "last_contacted_at" TIMESTAMP(3),
ADD COLUMN     "next_call_at" TIMESTAMP(3),
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "enrichment" ADD COLUMN     "audit_done_at" TIMESTAMP(3),
ADD COLUMN     "audit_requested_at" TIMESTAMP(3),
ADD COLUMN     "audit_status" "AuditStatus" NOT NULL DEFAULT 'not_requested';

-- CreateIndex
CREATE INDEX "lead_delivery_subscriber_id_next_call_at_idx" ON "lead_delivery"("subscriber_id", "next_call_at");

-- CreateIndex
CREATE INDEX "lead_delivery_subscriber_id_lead_outcome_idx" ON "lead_delivery"("subscriber_id", "lead_outcome");

-- CreateIndex
CREATE INDEX "enrichment_audit_status_idx" ON "enrichment"("audit_status");
