-- AlterTable
ALTER TABLE "ticket_comments" ADD COLUMN     "visibleTo" TEXT NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "senderId" TEXT,
ADD COLUMN     "travelerId" TEXT;
