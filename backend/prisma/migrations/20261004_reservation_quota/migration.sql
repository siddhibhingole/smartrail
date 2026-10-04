CREATE TYPE "public"."ReservationQuota" AS ENUM ('GENERAL', 'TATKAL', 'LADIES', 'SENIOR_CITIZEN');

ALTER TABLE "public"."Booking"
ADD COLUMN "quota" "public"."ReservationQuota" NOT NULL DEFAULT 'GENERAL';

ALTER TABLE "public"."Booking"
ADD COLUMN "travelClass" TEXT NOT NULL DEFAULT 'ALL';
