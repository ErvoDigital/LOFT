export async function writeDocumentSnapshot(db, documentId, content, now = new Date()) {
  return db.$transaction(async (tx) => {
    const old = await tx.document.findUnique({ where: { id: documentId }, select: { content: true, title: true } });
    if (old?.content) {
      const latest = await tx.documentRevision.findFirst({ where: { documentId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      if (!latest || now - new Date(latest.createdAt) >= 5 * 60000) {
        await tx.documentRevision.create({ data: { documentId, title: old.title, content: old.content } });
        const expired = await tx.documentRevision.findMany({ where: { documentId }, orderBy: { createdAt: "desc" }, skip: 50, select: { id: true } });
        if (expired.length) await tx.documentRevision.deleteMany({ where: { id: { in: expired.map((row) => row.id) } } });
      }
    }
    return tx.document.update({ where: { id: documentId }, data: { content } });
  });
}
