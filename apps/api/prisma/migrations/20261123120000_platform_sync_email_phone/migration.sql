-- CreateEnum
CREATE TYPE "PlatformEventStatus" AS ENUM ('PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'COMPLETED', 'MISSED', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'PLATFORM_EVENT';
ALTER TYPE "ActivityType" ADD VALUE 'EMAIL_SENT';
ALTER TYPE "ActivityType" ADD VALUE 'CALL';
ALTER TYPE "ActivityType" ADD VALUE 'SMS_SENT';
ALTER TYPE "ActivityType" ADD VALUE 'SMS_RECEIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MISSED_CALL';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_SMS';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "callId" TEXT;

-- AlterTable
ALTER TABLE "customer_platforms" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookSecretEnc" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "platform_events" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "PlatformEventStatus" NOT NULL,
    "error" TEXT,
    "customerId" TEXT,
    "created" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "twilioSid" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "durationSec" INTEGER,
    "customerId" TEXT,
    "userId" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "twilioSid" TEXT NOT NULL,
    "direction" "SmsDirection" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "customerId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "platform_events_platformId_receivedAt_idx" ON "platform_events"("platformId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_events_platformId_eventId_key" ON "platform_events"("platformId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "email_connections_userId_key" ON "email_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calls_twilioSid_key" ON "calls"("twilioSid");

-- CreateIndex
CREATE INDEX "calls_startedAt_idx" ON "calls"("startedAt");

-- CreateIndex
CREATE INDEX "calls_customerId_idx" ON "calls"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_messages_twilioSid_key" ON "sms_messages"("twilioSid");

-- CreateIndex
CREATE INDEX "sms_messages_createdAt_idx" ON "sms_messages"("createdAt");

-- CreateIndex
CREATE INDEX "sms_messages_customerId_idx" ON "sms_messages"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "activities_callId_key" ON "activities"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_platforms_platformId_externalId_key" ON "customer_platforms"("platformId", "externalId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_events" ADD CONSTRAINT "platform_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

