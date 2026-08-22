-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "refundAmount" DROP NOT NULL,
ALTER COLUMN "refundReason" DROP NOT NULL;
