/*
  Warnings:

  - You are about to drop the column `assigneeId` on the `Document` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_assigneeId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "assigneeId";

-- CreateTable
CREATE TABLE "DocumentAssignee" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DocumentAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAssignee_documentId_userId_key" ON "DocumentAssignee"("documentId", "userId");

-- AddForeignKey
ALTER TABLE "DocumentAssignee" ADD CONSTRAINT "DocumentAssignee_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignee" ADD CONSTRAINT "DocumentAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
