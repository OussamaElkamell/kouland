-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "workMode" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "motivation" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "availableFrom" TEXT NOT NULL,
    "salaryExpectation" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "locale" TEXT NOT NULL,
    "cvFileName" TEXT NOT NULL,
    "cvMimeType" TEXT NOT NULL,
    "cvSize" INTEGER NOT NULL,
    "cvData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_applications_createdAt_idx" ON "job_applications"("createdAt");

-- CreateIndex
CREATE INDEX "job_applications_email_idx" ON "job_applications"("email");
