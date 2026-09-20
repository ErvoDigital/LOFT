import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { emitToUser } from "../sockets/io.js";

const personSelect = { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } };

// What the viewer sees on someone else's profile:
//   none      nothing between you
//   outgoing  you asked, they haven't answered
//   incoming  they asked, it's on you to answer
//   following accepted, both ways
export function followState(row, viewerId) {
  if (!row) return "none";
  if (row.status === "ACCEPTED") return "following";
  return row.requesterId === viewerId ? "outgoing" : "incoming";
}

// The one row between two people, in whichever direction it was created.
export function findFollowRow(aId, bId) {
  return prisma.follow.findFirst({
    where: {
      OR: [
        { requesterId: aId, addresseeId: bId },
        { requesterId: bId, addresseeId: aId },
      ],
    },
  });
}

async function assertUserExists(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

// Everyone connected to the caller, split by what the UI does with each
// group: `following` fills the people list in the new-message dialog,
// `incoming` is the only one needing an answer, `outgoing` is just waiting.
export async function listMyFollows(req, res) {
  const rows = await prisma.follow.findMany({
    where: { OR: [{ requesterId: req.userId }, { addresseeId: req.userId }] },
    include: { requester: personSelect, addressee: personSelect },
    orderBy: { createdAt: "desc" },
  });

  const other = (row) => (row.requesterId === req.userId ? row.addressee : row.requester);
  res.json({
    following: rows.filter((r) => r.status === "ACCEPTED").map(other),
    incoming: rows
      .filter((r) => r.status === "PENDING" && r.addresseeId === req.userId)
      .map((r) => ({ ...r.requester, requestedAt: r.createdAt })),
    outgoing: rows
      .filter((r) => r.status === "PENDING" && r.requesterId === req.userId)
      .map((r) => ({ ...r.addressee, requestedAt: r.createdAt })),
  });
}

// Asking to follow someone. If they already asked you, this is taken as the
// answer rather than a second, crossing request — two people who both reach
// for the button shouldn't end up stuck waiting on each other.
export async function requestFollow(req, res) {
  const targetId = req.params.userId;
  if (targetId === req.userId) throw new ApiError(400, "You can't follow yourself");
  await assertUserExists(targetId);

  const existing = await findFollowRow(req.userId, targetId);
  if (existing?.status === "ACCEPTED") {
    return res.json({ state: "following" });
  }
  if (existing) {
    if (existing.requesterId === req.userId) return res.json({ state: "outgoing" });
    return acceptFollowRow(existing, req.userId, res);
  }

  await prisma.follow.create({ data: { requesterId: req.userId, addresseeId: targetId } });
  const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
  await notify(targetId, {
    type: "FOLLOW_REQUEST",
    title: `${me.name} wants to follow you`,
    body: "Accept to add each other to your people lists.",
    link: "/profile",
  });
  emitToUser(targetId, "follow:updated", { userId: req.userId });
  res.status(201).json({ state: "outgoing" });
}

async function acceptFollowRow(row, viewerId, res) {
  await prisma.follow.update({
    where: { id: row.id },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  const me = await prisma.user.findUnique({ where: { id: viewerId }, select: { name: true } });
  await notify(row.requesterId, {
    type: "FOLLOW_ACCEPTED",
    title: `${me.name} accepted your follow request`,
    body: "You'll now see each other in your people lists.",
    link: "/profile",
  });
  emitToUser(row.requesterId, "follow:updated", { userId: viewerId });
  return res.json({ state: "following" });
}

export async function acceptFollow(req, res) {
  const row = await findFollowRow(req.userId, req.params.userId);
  if (!row || row.status !== "PENDING") throw new ApiError(404, "No follow request to accept");
  if (row.addresseeId !== req.userId) throw new ApiError(403, "That request isn't yours to accept");
  return acceptFollowRow(row, req.userId, res);
}

// Declining, cancelling your own request, and unfollowing are all the same
// act on the same row — the row is dropped rather than kept in a third state,
// so asking again later is a clean insert.
export async function removeFollow(req, res) {
  const row = await findFollowRow(req.userId, req.params.userId);
  if (!row) return res.json({ state: "none" });

  await prisma.follow.delete({ where: { id: row.id } });
  const otherId = row.requesterId === req.userId ? row.addresseeId : row.requesterId;
  emitToUser(otherId, "follow:updated", { userId: req.userId });
  res.json({ state: "none" });
}
