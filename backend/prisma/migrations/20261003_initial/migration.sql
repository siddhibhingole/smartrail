-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('PASSENGER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "public"."SeatType" AS ENUM ('WINDOW', 'MIDDLE', 'AISLE');

-- CreateEnum
CREATE TYPE "public"."SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');

-- CreateEnum
CREATE TYPE "public"."AllocationStatus" AS ENUM ('HELD', 'BOOKED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITING', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."WaitingStatus" AS ENUM ('WAITING', 'PROMOTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('BOOKING', 'CANCELLATION', 'REFUND', 'WAITING_LIST_PROMOTION', 'SEAT_ALLOCATION', 'UNDO');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('UPI', 'CARD', 'NET_BANKING', 'WALLET', 'CASH');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "public"."MedicalPriority" AS ENUM ('HIGH', 'MEDIUM', 'NORMAL');

-- CreateEnum
CREATE TYPE "public"."MedicalStatus" AS ENUM ('REQUESTED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'PASSENGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Passenger" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "public"."Gender" NOT NULL DEFAULT 'UNDISCLOSED',
    "phone" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Station" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Train" (
    "id" TEXT NOT NULL,
    "trainNumber" TEXT NOT NULL,
    "trainName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Train_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainRoute" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "arrivalTime" TEXT,
    "departureTime" TEXT,

    CONSTRAINT "TrainRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Coach" (
    "id" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "coachNumber" TEXT NOT NULL,
    "coachType" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Seat" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "seatType" "public"."SeatType" NOT NULL,
    "status" "public"."SeatStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeatAllocation" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "journeyDate" DATE NOT NULL,
    "status" "public"."AllocationStatus" NOT NULL,
    "holdToken" TEXT,
    "heldUntil" TIMESTAMP(3),
    "bookingPassengerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "pnr" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "userId" TEXT NOT NULL,
    "trainId" TEXT NOT NULL,
    "journeyDate" DATE NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingPassenger" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "seatId" TEXT,
    "coachId" TEXT,
    "seatPreference" "public"."SeatType",
    "fare" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WaitingList" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "public"."WaitingStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),

    CONSTRAINT "WaitingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" "public"."TransactionType" NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "public"."PaymentMethod",
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL,
    "gatewayReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "pnr" TEXT NOT NULL,
    "coach" TEXT NOT NULL,
    "seat" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "contact" TEXT,
    "priority" "public"."MedicalPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "public"."MedicalStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UndoTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reversible" BOOLEAN NOT NULL DEFAULT true,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UndoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Passenger_userId_idx" ON "public"."Passenger"("userId");

-- CreateIndex
CREATE INDEX "Passenger_fullName_idx" ON "public"."Passenger"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Station_code_key" ON "public"."Station"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Train_trainNumber_key" ON "public"."Train"("trainNumber");

-- CreateIndex
CREATE INDEX "Train_source_destination_idx" ON "public"."Train"("source", "destination");

-- CreateIndex
CREATE INDEX "TrainRoute_stationId_idx" ON "public"."TrainRoute"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainRoute_trainId_stopOrder_key" ON "public"."TrainRoute"("trainId", "stopOrder");

-- CreateIndex
CREATE INDEX "Coach_trainId_idx" ON "public"."Coach"("trainId");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_trainId_coachNumber_key" ON "public"."Coach"("trainId", "coachNumber");

-- CreateIndex
CREATE INDEX "Seat_coachId_status_idx" ON "public"."Seat"("coachId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_coachId_seatNumber_key" ON "public"."Seat"("coachId", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_bookingPassengerId_key" ON "public"."SeatAllocation"("bookingPassengerId");

-- CreateIndex
CREATE INDEX "SeatAllocation_holdToken_idx" ON "public"."SeatAllocation"("holdToken");

-- CreateIndex
CREATE INDEX "SeatAllocation_journeyDate_status_heldUntil_idx" ON "public"."SeatAllocation"("journeyDate", "status", "heldUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_seatId_journeyDate_key" ON "public"."SeatAllocation"("seatId", "journeyDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_pnr_key" ON "public"."Booking"("pnr");

-- CreateIndex
CREATE INDEX "Booking_trainId_journeyDate_status_idx" ON "public"."Booking"("trainId", "journeyDate", "status");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "public"."Booking"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_userId_idempotencyKey_key" ON "public"."Booking"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BookingPassenger_bookingId_idx" ON "public"."BookingPassenger"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitingList_bookingId_key" ON "public"."WaitingList"("bookingId");

-- CreateIndex
CREATE INDEX "WaitingList_status_createdAt_position_idx" ON "public"."WaitingList"("status", "createdAt", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_referenceId_key" ON "public"."Transaction"("referenceId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "public"."Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_bookingId_type_idx" ON "public"."Transaction"("bookingId", "type");

-- CreateIndex
CREATE INDEX "Transaction_type_status_createdAt_idx" ON "public"."Transaction"("type", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "public"."Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "public"."Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "public"."Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalRequest_priority_status_createdAt_idx" ON "public"."MedicalRequest"("priority", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalRequest_pnr_idx" ON "public"."MedicalRequest"("pnr");

-- CreateIndex
CREATE UNIQUE INDEX "UndoTransaction_transactionId_key" ON "public"."UndoTransaction"("transactionId");

-- CreateIndex
CREATE INDEX "UndoTransaction_userId_reversible_reversedAt_createdAt_idx" ON "public"."UndoTransaction"("userId", "reversible", "reversedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "public"."AuditLog"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "public"."AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Passenger" ADD CONSTRAINT "Passenger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainRoute" ADD CONSTRAINT "TrainRoute_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "public"."Train"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainRoute" ADD CONSTRAINT "TrainRoute_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "public"."Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Coach" ADD CONSTRAINT "Coach_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "public"."Train"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Seat" ADD CONSTRAINT "Seat_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatAllocation" ADD CONSTRAINT "SeatAllocation_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "public"."Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatAllocation" ADD CONSTRAINT "SeatAllocation_bookingPassengerId_fkey" FOREIGN KEY ("bookingPassengerId") REFERENCES "public"."BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_trainId_fkey" FOREIGN KEY ("trainId") REFERENCES "public"."Train"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPassenger" ADD CONSTRAINT "BookingPassenger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPassenger" ADD CONSTRAINT "BookingPassenger_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "public"."Passenger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPassenger" ADD CONSTRAINT "BookingPassenger_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "public"."Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPassenger" ADD CONSTRAINT "BookingPassenger_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WaitingList" ADD CONSTRAINT "WaitingList_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalRequest" ADD CONSTRAINT "MedicalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UndoTransaction" ADD CONSTRAINT "UndoTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UndoTransaction" ADD CONSTRAINT "UndoTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
