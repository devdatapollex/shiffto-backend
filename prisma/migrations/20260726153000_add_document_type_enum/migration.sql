-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'DRIVING_LICENSE', 'NID');

-- AlterTable with explicit cast to prevent data loss
ALTER TABLE "kyc" ALTER COLUMN "documentType" TYPE "DocumentType" USING (
  CASE 
    WHEN "documentType" IN ('PASSPORT', 'DRIVING_LICENSE', 'NID') THEN "documentType"::"DocumentType"
    ELSE 'PASSPORT'::"DocumentType"
  END
);
