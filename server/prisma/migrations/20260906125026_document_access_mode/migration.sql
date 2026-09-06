-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'WORKSPACE';

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
