import { prisma } from "../db/prisma.js";
import { deleteStoredVersions } from "./assetStorage.js";

export async function purgeConversationAndAttachments(conversation) {
  // Message references are authoritative even if an older attachment was
  // moved before system-folder moves were prohibited. Assets still in the
  // managed folder cover uploads abandoned before a message was sent.
  const [messages, folder] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: conversation.id, attachmentAssetId: { not: null } },
      select: { attachmentAssetId: true },
    }),
    prisma.folder.findUnique({
      where: { chatConversationId: conversation.id },
      select: { assets: { select: { id: true } } },
    }),
  ]);

  const assetIds = [
    ...new Set([
      ...messages.map((message) => message.attachmentAssetId).filter(Boolean),
      ...(folder?.assets || []).map((asset) => asset.id),
    ]),
  ];
  const assets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds }, workspaceId: conversation.workspaceId },
        include: { versions: true },
      })
    : [];

  await deleteStoredVersions(
    conversation.workspaceId,
    assets.flatMap((asset) => asset.versions)
  );

  await prisma.$transaction([
    prisma.asset.deleteMany({ where: { id: { in: assets.map((asset) => asset.id) } } }),
    prisma.conversation.delete({ where: { id: conversation.id } }),
  ]);
}
