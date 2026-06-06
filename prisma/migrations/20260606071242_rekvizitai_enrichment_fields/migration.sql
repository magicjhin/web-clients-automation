-- CreateEnum
CREATE TYPE "CreditRisk" AS ENUM ('A', 'B', 'C', 'D', 'E', 'unknown');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EnrichStatus" ADD VALUE 'rekvizitai_done';
ALTER TYPE "EnrichStatus" ADD VALUE 'archived_garbage';

-- AlterTable
ALTER TABLE "enrichment" ADD COLUMN     "credit_label" TEXT,
ADD COLUMN     "credit_risk" "CreditRisk",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fin_year" INTEGER,
ADD COLUMN     "has_website" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "profit" DECIMAL(14,2),
ADD COLUMN     "revenue" DECIMAL(14,2);
