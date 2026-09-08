-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "chatConversationId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentAssetId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Folder_chatConversationId_key" ON "Folder"("chatConversationId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_attachmentAssetId_fkey" FOREIGN KEY ("attachmentAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_chatConversationId_fkey" FOREIGN KEY ("chatConversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

