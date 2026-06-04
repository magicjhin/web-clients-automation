-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('active', 'inactive', 'unknown');

-- CreateEnum
CREATE TYPE "EnrichStatus" AS ENUM ('pending', 'places_done', 'fallback_done', 'skipped_limit');

-- CreateEnum
CREATE TYPE "WebsiteStatus" AS ENUM ('not_checked', 'candidate_found', 'verified_own_website', 'no_own_website', 'external_profile_only', 'ambiguous', 'wrong_match');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('rc_code_on_site', 'phone_match', 'address_match', 'strong_name_city_match', 'manual_review', 'none');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('auto_approved', 'needs_review', 'manually_approved', 'rejected');

-- CreateEnum
CREATE TYPE "LeadBranch" AS ENUM ('A_bad_site', 'B_no_site', 'not_lead');

-- CreateEnum
CREATE TYPE "Bucket" AS ENUM ('active_lead', 'recheck_later', 'dead');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('active', 'trial', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'confirmed', 'sent');

-- CreateEnum
CREATE TYPE "LeadOutcome" AS ENUM ('sent', 'in_progress', 'won', 'no_response', 'lost');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'cancelled');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "rc_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "evrk2_code" TEXT NOT NULL,
    "evrk2_name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL,
    "sector" TEXT,
    "legal_form" TEXT,
    "address" TEXT,
    "city" TEXT,
    "reg_date" DATE,
    "financials" JSONB,
    "rc_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "enrich_status" "EnrichStatus" NOT NULL DEFAULT 'pending',
    "website_status" "WebsiteStatus" NOT NULL DEFAULT 'not_checked',
    "website_url" TEXT,
    "phone" TEXT,
    "google_rating" DECIMAL(3,1),
    "pagespeed_mobile" INTEGER,
    "pagespeed_desktop" INTEGER,
    "audit_issues" JSONB,
    "lead_branch" "LeadBranch",
    "enriched_at" TIMESTAMP(3),
    "recheck_at" TIMESTAMP(3),
    "places_query_count" INTEGER NOT NULL DEFAULT 0,
    "places_second_query_used" BOOLEAN NOT NULL DEFAULT false,
    "places_match_confidence" "MatchConfidence",
    "places_match_score" INTEGER,
    "places_match_reason" JSONB,
    "verification_method" "VerificationMethod",
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'needs_review',

    CONSTRAINT "enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places_usage" (
    "id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "limit_max" INTEGER NOT NULL DEFAULT 5000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_state" (
    "company_id" UUID NOT NULL,
    "bucket" "Bucket" NOT NULL,
    "last_change" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_state_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "resend_api_key" TEXT,
    "resend_domain_verified" BOOLEAN NOT NULL DEFAULT false,
    "profile" JSONB,
    "price_policy" JSONB,
    "selected_niches" JSONB,
    "legal_form" TEXT,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'trial',
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_delivery" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_until" TIMESTAMP(3),
    "lead_outcome" "LeadOutcome" NOT NULL DEFAULT 'sent',
    "won_at" TIMESTAMP(3),
    "deal_value" DECIMAL(10,2),
    "lost_reason" TEXT,

    CONSTRAINT "lead_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_content" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "audit_text" TEXT,
    "email_text" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "generated_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "tier" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_rc_code_key" ON "companies"("rc_code");

-- CreateIndex
CREATE INDEX "companies_evrk2_code_idx" ON "companies"("evrk2_code");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "companies_evrk2_code_status_idx" ON "companies"("evrk2_code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrichment_company_id_key" ON "enrichment"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "places_usage_period_key" ON "places_usage"("period");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE INDEX "lead_delivery_subscriber_id_company_id_idx" ON "lead_delivery"("subscriber_id", "company_id");

-- CreateIndex
CREATE INDEX "generated_content_subscriber_id_company_id_idx" ON "generated_content"("subscriber_id", "company_id");

-- AddForeignKey
ALTER TABLE "enrichment" ADD CONSTRAINT "enrichment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state" ADD CONSTRAINT "lead_state_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_delivery" ADD CONSTRAINT "lead_delivery_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_delivery" ADD CONSTRAINT "lead_delivery_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

