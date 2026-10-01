import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { clientUrl, isMailConfigured, sendMail } from "../services/mail.service.js";
import { buildInviteEmail } from "../utils/inviteEmail.js";
import { admitMember, workspaceSummary } from "./workspaces.controller.js";

// Emailed invites (see WorkspaceInvite in schema.prisma). Admins send, list and
// withdraw them from Settings; the person invited opens the emailed link,
// which is public so it can say who invited them before they've signed in.
const INVITE_TTL_DAYS = 7;
export const MAX_INVITES_PER_SEND = 20;
// SMTP providers cap simultaneous sessions (Gmail turns away more than a
// handful), so a full send goes out a few at a time.
const SEND_BATCH = 4;

const sendSchema = z.object({
  emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(MAX_INVITES_PER_SEND),
});

const tokenSchema = z.string().min(20).max(100);

const generateInviteToken = () => crypto.randomBytes(24).toString("base64url");

function serializeInvite(invite) {
  return {
    id: invite.id,
    email: invite.email,
    link: clientUrl(`/invite/${invite.token}`),
    expiresAt: invite.expiresAt,
    expired: invite.expiresAt < new Date(),
    sentAt: invite.updatedAt,
    invitedBy: invite.invitedBy,
  };
}

async function listOutstanding(workspaceId) {
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId },
    include: { invitedBy: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return invites.map(serializeInvite);
}

export async function listInvites(req, res) {
  res.json({ invites: await listOutstanding(req.params.workspaceId), emailEnabled: isMailConfigured() });
}

// Inviting an address that already has an invite refreshes it: a new expiry
// and a fresh email, but the same token, so the link in an earlier email
// keeps working. Someone who already has a LOFT account is also told in-app,
// which is the only delivery there is while email isn't set up.
export async function sendInvites(req, res) {
  const { workspaceId } = req.params;
  const emails = [...new Set(sendSchema.parse(req.body).emails)];

  const [workspace, inviter, accounts] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } }),
    prisma.user.findMany({
      // Accounts store their email lowercased (see auth.controller.js).
      where: { email: { in: emails } },
      select: { id: true, email: true, memberships: { where: { workspaceId }, select: { id: true } } },
    }),
  ]);
  const accountByEmail = new Map(accounts.map((a) => [a.email.toLowerCase(), a]));
  const emailEnabled = isMailConfigured();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  async function inviteOne(email) {
    const account = accountByEmail.get(email);
    if (account?.memberships.length) return { email, status: "member" };

    const invite = await prisma.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      update: { invitedById: req.userId, expiresAt },
      create: { workspaceId, email, token: generateInviteToken(), invitedById: req.userId, expiresAt },
    });

    if (account) {
      await notify(account.id, {
        type: "WORKSPACE_INVITE",
        title: `${inviter.name} invited you to ${workspace.name}`,
        body: "Open the invite to join the workspace.",
        link: `/invite/${invite.token}`,
      });
    }

    let emailed = false;
    if (emailEnabled) {
      try {
        await sendMail({
          to: email,
          ...buildInviteEmail({
            workspaceName: workspace.name,
            inviterName: inviter.name,
            email,
            link: clientUrl(`/invite/${invite.token}`),
            expiresInDays: INVITE_TTL_DAYS,
          }),
        });
        emailed = true;
      } catch (err) {
        console.error(`invite email to ${email} failed`, err);
      }
    }

    return { email, status: "invited", emailed, notified: Boolean(account) };
  }

  const results = [];
  for (let i = 0; i < emails.length; i += SEND_BATCH) {
    results.push(...(await Promise.all(emails.slice(i, i + SEND_BATCH).map(inviteOne))));
  }

  res.status(201).json({ results, invites: await listOutstanding(workspaceId), emailEnabled });
}

export async function revokeInvite(req, res) {
  const invite = await prisma.workspaceInvite.findUnique({ where: { id: req.params.inviteId } });
  // An invite id is global, so check it belongs to the workspace in the URL.
  if (!invite || invite.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Invite not found");

  await prisma.workspaceInvite.delete({ where: { id: invite.id } });
  res.json({ message: "Invite withdrawn" });
}

async function findInvite(token) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token: tokenSchema.parse(token) },
    include: {
      workspace: { include: { _count: { select: { members: true } } } },
      invitedBy: { select: { name: true, avatarColor: true, avatarUrl: true } },
    },
  });
  if (!invite) throw new ApiError(404, "This invite has already been used or was withdrawn");
  return invite;
}

// Public: the token is the secret, and this shows only what the email itself
// already said.
export async function getInvite(req, res) {
  const invite = await findInvite(req.params.token);
  const { workspace } = invite;
  res.json({
    invite: {
      email: invite.email,
      expiresAt: invite.expiresAt,
      expired: invite.expiresAt < new Date(),
      invitedBy: invite.invitedBy,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color,
        logoUrl: workspace.logoUrl,
        memberCount: workspace._count.members,
      },
    },
  });
}

export async function acceptInvite(req, res) {
  const invite = await findInvite(req.params.token);
  if (invite.expiresAt < new Date()) {
    throw new ApiError(410, "This invite has expired. Ask an admin to send you a new one.");
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (user.email.toLowerCase() !== invite.email) {
    throw new ApiError(403, `This invite was sent to ${invite.email}. Sign in with that email to accept it.`);
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: req.userId } },
  });
  if (existing) {
    await prisma.workspaceInvite.delete({ where: { id: invite.id } });
    return res.json({ workspace: workspaceSummary(invite.workspace, existing.role) });
  }

  // admitMember also clears this invite, since it's addressed to this user.
  await admitMember(invite.workspace, req.userId);
  res.status(201).json({ workspace: workspaceSummary(invite.workspace, "MEMBER") });
}
