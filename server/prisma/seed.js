import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

let defaultPrisma = null;

function getDefaultPrisma() {
  if (!defaultPrisma) {
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

// Deterministic UUIDs for development fixtures
export const SEED_IDS = {
  users: {
    alice: "a0000001-0000-4000-8000-000000000001",
    bob: "a0000002-0000-4000-8000-000000000002",
    charlie: "a0000003-0000-4000-8000-000000000003",
    diana: "a0000004-0000-4000-8000-000000000004",
  },
  workspaces: {
    alpha: "b0000001-0000-4000-8000-000000000001",
    beta: "b0000002-0000-4000-8000-000000000002",
    gamma: "b0000003-0000-4000-8000-000000000003",
  },
  taskStatuses: {
    alphaTodo: "c0000001-0000-4000-8000-000000000001",
    alphaInProgress: "c0000002-0000-4000-8000-000000000002",
    alphaCompleted: "c0000003-0000-4000-8000-000000000003",
    betaTodo: "c0000004-0000-4000-8000-000000000004",
    betaInProgress: "c0000005-0000-4000-8000-000000000005",
    betaCompleted: "c0000006-0000-4000-8000-000000000006",
    gammaTodo: "c0000007-0000-4000-8000-000000000007",
    gammaInProgress: "c0000008-0000-4000-8000-000000000008",
    gammaCompleted: "c0000009-0000-4000-8000-000000000009",
  },
  tasks: {
    alphaNav: "d0000001-0000-4000-8000-000000000001",
    alphaCi: "d0000002-0000-4000-8000-000000000002",
    betaMarketing: "d0000003-0000-4000-8000-000000000003",
    gammaQuantum: "d0000004-0000-4000-8000-000000000004",
  },
  events: {
    alphaPlanning: "e0000001-0000-4000-8000-000000000001",
    gammaClassified: "e0000002-0000-4000-8000-000000000002",
  },
  conversations: {
    alphaGeneral: "f0000001-0000-4000-8000-000000000001",
    betaGeneral: "f0000002-0000-4000-8000-000000000002",
    gammaGeneral: "f0000003-0000-4000-8000-000000000003",
  },
  messages: {
    alphaMsg1: "10000001-0000-4000-8000-000000000001",
    alphaMsg2: "10000002-0000-4000-8000-000000000002",
    betaMsg1: "10000003-0000-4000-8000-000000000003",
    gammaMsg1: "10000004-0000-4000-8000-000000000004",
  },
  folders: {
    alphaPublic: "20000001-0000-4000-8000-000000000001",
    alphaRestricted: "20000002-0000-4000-8000-000000000002",
    betaPublic: "20000003-0000-4000-8000-000000000003",
    gammaRestricted: "20000004-0000-4000-8000-000000000004",
  },
  assets: {
    alphaLogo: "30000001-0000-4000-8000-000000000001",
    alphaBudget: "30000002-0000-4000-8000-000000000002",
    betaPressRelease: "30000003-0000-4000-8000-000000000003",
    gammaSchematic: "30000004-0000-4000-8000-000000000004",
  },
  assetVersions: {
    alphaLogoV1: "40000001-0000-4000-8000-000000000001",
    alphaBudgetV1: "40000002-0000-4000-8000-000000000002",
    betaPressReleaseV1: "40000003-0000-4000-8000-000000000003",
    gammaSchematicV1: "40000004-0000-4000-8000-000000000004",
  },
  documents: {
    alphaPrd: "50000001-0000-4000-8000-000000000001",
    gammaSecretSpec: "50000002-0000-4000-8000-000000000002",
  },
  notifications: {
    bobWelcome: "60000001-0000-4000-8000-000000000001",
  },
};

export async function seed(injectedClient = null) {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Refusing to run development seed in production environment (NODE_ENV=production).");
    if (process.argv[1]?.endsWith("seed.js")) {
      process.exit(1);
    }
    throw new Error("Refusing to run development seed in production environment (NODE_ENV=production).");
  }

  if (process.env.ALLOW_DEV_SEED !== "true") {
    console.error("❌ Development seed blocked: ALLOW_DEV_SEED=true is required to execute the development seed script.");
    if (process.argv[1]?.endsWith("seed.js")) {
      process.exit(1);
    }
    throw new Error("Development seed blocked: ALLOW_DEV_SEED=true is required to execute the development seed script.");
  }

  const prisma = injectedClient || getDefaultPrisma();
  console.log("🌱 Starting idempotent development database seed...");

  const devPasswordHash = await bcrypt.hash("DevPassword123!", 10);

  // 1. Users
  const users = [
    {
      id: SEED_IDS.users.alice,
      name: "Alice Walker",
      email: "alice@loft.test",
      passwordHash: devPasswordHash,
      avatarColor: "#5B5BD6",
    },
    {
      id: SEED_IDS.users.bob,
      name: "Bob Smith",
      email: "bob@loft.test",
      passwordHash: devPasswordHash,
      avatarColor: "#2A9D8F",
    },
    {
      id: SEED_IDS.users.charlie,
      name: "Charlie Davis",
      email: "charlie@loft.test",
      passwordHash: devPasswordHash,
      avatarColor: "#E76F51",
    },
    {
      id: SEED_IDS.users.diana,
      name: "Diana Prince",
      email: "diana@loft.test",
      passwordHash: devPasswordHash,
      avatarColor: "#3D8BFD",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, avatarColor: u.avatarColor },
      create: u,
    });
  }
  console.log(`✓ Seeded ${users.length} users`);

  // 2. Workspaces
  // Workspace Alpha: Acme Product Team (Alice: Owner/Admin, Bob: Member, Diana: Member)
  // Workspace Beta: Marketing & Growth (Alice: Owner/Member)
  // Workspace Gamma: Confidential R&D (Charlie: Owner/Admin, completely isolated)
  const workspaces = [
    {
      id: SEED_IDS.workspaces.alpha,
      name: "Acme Product Team",
      description: "Primary engineering and product workspace for Acme Corp.",
      type: "work",
      color: "#5B5BD6",
      inviteCode: "ALPHA-DEV-INVITE",
      ownerId: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.workspaces.beta,
      name: "Marketing & Growth",
      description: "Brand campaigns, public relations, and growth experiments.",
      type: "work",
      color: "#2A9D8F",
      inviteCode: "BETA-DEV-INVITE",
      ownerId: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.workspaces.gamma,
      name: "Confidential R&D",
      description: "Isolated skunkworks research facility.",
      type: "org",
      color: "#E76F51",
      inviteCode: "GAMMA-DEV-INVITE",
      ownerId: SEED_IDS.users.charlie,
    },
  ];

  for (const w of workspaces) {
    await prisma.workspace.upsert({
      where: { inviteCode: w.inviteCode },
      update: { name: w.name, description: w.description, color: w.color },
      create: w,
    });
  }
  console.log(`✓ Seeded ${workspaces.length} workspaces`);

  // 3. Workspace Memberships
  const memberships = [
    { workspaceId: SEED_IDS.workspaces.alpha, userId: SEED_IDS.users.alice, role: "ADMIN" },
    { workspaceId: SEED_IDS.workspaces.alpha, userId: SEED_IDS.users.bob, role: "MEMBER" },
    { workspaceId: SEED_IDS.workspaces.alpha, userId: SEED_IDS.users.diana, role: "MEMBER" },
    { workspaceId: SEED_IDS.workspaces.beta, userId: SEED_IDS.users.alice, role: "ADMIN" },
    { workspaceId: SEED_IDS.workspaces.gamma, userId: SEED_IDS.users.charlie, role: "ADMIN" },
  ];

  for (const m of memberships) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: m.workspaceId, userId: m.userId } },
      update: { role: m.role },
      create: m,
    });
  }
  console.log(`✓ Seeded ${memberships.length} workspace memberships`);

  // 4. Task Statuses
  const taskStatuses = [
    // Alpha
    { id: SEED_IDS.taskStatuses.alphaTodo, workspaceId: SEED_IDS.workspaces.alpha, label: "To do", color: "#8a8578", order: 0, isDone: false },
    { id: SEED_IDS.taskStatuses.alphaInProgress, workspaceId: SEED_IDS.workspaces.alpha, label: "In progress", color: "#3b82f6", order: 1, isDone: false },
    { id: SEED_IDS.taskStatuses.alphaCompleted, workspaceId: SEED_IDS.workspaces.alpha, label: "Completed", color: "#10b981", order: 2, isDone: true },
    // Beta
    { id: SEED_IDS.taskStatuses.betaTodo, workspaceId: SEED_IDS.workspaces.beta, label: "To do", color: "#8a8578", order: 0, isDone: false },
    { id: SEED_IDS.taskStatuses.betaInProgress, workspaceId: SEED_IDS.workspaces.beta, label: "In progress", color: "#3b82f6", order: 1, isDone: false },
    { id: SEED_IDS.taskStatuses.betaCompleted, workspaceId: SEED_IDS.workspaces.beta, label: "Completed", color: "#10b981", order: 2, isDone: true },
    // Gamma
    { id: SEED_IDS.taskStatuses.gammaTodo, workspaceId: SEED_IDS.workspaces.gamma, label: "To do", color: "#8a8578", order: 0, isDone: false },
    { id: SEED_IDS.taskStatuses.gammaInProgress, workspaceId: SEED_IDS.workspaces.gamma, label: "In progress", color: "#3b82f6", order: 1, isDone: false },
    { id: SEED_IDS.taskStatuses.gammaCompleted, workspaceId: SEED_IDS.workspaces.gamma, label: "Completed", color: "#10b981", order: 2, isDone: true },
  ];

  for (const ts of taskStatuses) {
    await prisma.taskStatus.upsert({
      where: { id: ts.id },
      update: { label: ts.label, color: ts.color, isDone: ts.isDone },
      create: ts,
    });
  }
  console.log(`✓ Seeded ${taskStatuses.length} task statuses`);

  // 5. Tasks
  const tasks = [
    {
      id: SEED_IDS.tasks.alphaNav,
      workspaceId: SEED_IDS.workspaces.alpha,
      title: "Design Navigation System",
      description: "Design the topbar and command palette for rapid workspace switching.",
      tier: "TIER_1",
      status: SEED_IDS.taskStatuses.alphaTodo,
      order: 0,
      createdById: SEED_IDS.users.alice,
      assigneeId: SEED_IDS.users.bob,
    },
    {
      id: SEED_IDS.tasks.alphaCi,
      workspaceId: SEED_IDS.workspaces.alpha,
      title: "Setup Automated CI Pipeline",
      description: "Configure GitHub Actions workflow for linting, database verification, and unit tests.",
      tier: "TIER_2",
      status: SEED_IDS.taskStatuses.alphaInProgress,
      order: 1,
      createdById: SEED_IDS.users.alice,
      assigneeId: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.tasks.betaMarketing,
      workspaceId: SEED_IDS.workspaces.beta,
      title: "Q4 Marketing Campaign Launch",
      description: "Plan social media announcements, customer newsletters, and press release distribution.",
      tier: "TIER_1",
      status: SEED_IDS.taskStatuses.betaTodo,
      order: 0,
      createdById: SEED_IDS.users.alice,
      assigneeId: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.tasks.gammaQuantum,
      workspaceId: SEED_IDS.workspaces.gamma,
      title: "Top Secret Quantum Architecture",
      description: "Research and implement proprietary post-quantum cryptographic primitives.",
      tier: "TIER_1",
      status: SEED_IDS.taskStatuses.gammaTodo,
      order: 0,
      createdById: SEED_IDS.users.charlie,
      assigneeId: SEED_IDS.users.charlie,
    },
  ];

  for (const t of tasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: { title: t.title, description: t.description, status: t.status, tier: t.tier },
      create: t,
    });
  }
  console.log(`✓ Seeded ${tasks.length} tasks`);

  // 6. Events & Attendees
  const events = [
    {
      id: SEED_IDS.events.alphaPlanning,
      workspaceId: SEED_IDS.workspaces.alpha,
      title: "Weekly Sprint Planning",
      description: "Review sprint deliverables and unblock team members.",
      startTime: new Date(Date.now() + 86400000), // +1 day
      endTime: new Date(Date.now() + 90000000),
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.events.gammaClassified,
      workspaceId: SEED_IDS.workspaces.gamma,
      title: "Classified Strategic Briefing",
      description: "Confidential executive review of skunkworks operations.",
      startTime: new Date(Date.now() + 172800000), // +2 days
      endTime: new Date(Date.now() + 176400000),
      createdById: SEED_IDS.users.charlie,
    },
  ];

  for (const e of events) {
    await prisma.event.upsert({
      where: { id: e.id },
      update: { title: e.title, description: e.description },
      create: e,
    });
  }

  const attendees = [
    { eventId: SEED_IDS.events.alphaPlanning, userId: SEED_IDS.users.alice },
    { eventId: SEED_IDS.events.alphaPlanning, userId: SEED_IDS.users.bob },
    { eventId: SEED_IDS.events.gammaClassified, userId: SEED_IDS.users.charlie },
  ];

  for (const ea of attendees) {
    await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: ea.eventId, userId: ea.userId } },
      update: {},
      create: ea,
    });
  }
  console.log(`✓ Seeded ${events.length} events and attendees`);

  // 7. Conversations & Participants
  const conversations = [
    {
      id: SEED_IDS.conversations.alphaGeneral,
      workspaceId: SEED_IDS.workspaces.alpha,
      isGroup: true,
      isDefault: true,
      title: "General",
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.conversations.betaGeneral,
      workspaceId: SEED_IDS.workspaces.beta,
      isGroup: true,
      isDefault: true,
      title: "General",
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.conversations.gammaGeneral,
      workspaceId: SEED_IDS.workspaces.gamma,
      isGroup: true,
      isDefault: true,
      title: "General",
      createdById: SEED_IDS.users.charlie,
    },
  ];

  for (const c of conversations) {
    await prisma.conversation.upsert({
      where: { id: c.id },
      update: { title: c.title },
      create: c,
    });
  }

  const participants = [
    { conversationId: SEED_IDS.conversations.alphaGeneral, userId: SEED_IDS.users.alice },
    { conversationId: SEED_IDS.conversations.alphaGeneral, userId: SEED_IDS.users.bob },
    { conversationId: SEED_IDS.conversations.alphaGeneral, userId: SEED_IDS.users.diana },
    { conversationId: SEED_IDS.conversations.betaGeneral, userId: SEED_IDS.users.alice },
    { conversationId: SEED_IDS.conversations.gammaGeneral, userId: SEED_IDS.users.charlie },
  ];

  for (const p of participants) {
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: p.conversationId, userId: p.userId } },
      update: {},
      create: p,
    });
  }

  // 8. Messages & Reactions
  const messages = [
    {
      id: SEED_IDS.messages.alphaMsg1,
      conversationId: SEED_IDS.conversations.alphaGeneral,
      senderId: SEED_IDS.users.alice,
      content: "Welcome team to the Acme product sprint!",
    },
    {
      id: SEED_IDS.messages.alphaMsg2,
      conversationId: SEED_IDS.conversations.alphaGeneral,
      senderId: SEED_IDS.users.bob,
      content: "Please review the updated navigation mockups and leave feedback.",
    },
    {
      id: SEED_IDS.messages.betaMsg1,
      conversationId: SEED_IDS.conversations.betaGeneral,
      senderId: SEED_IDS.users.alice,
      content: "Marketing campaign kickoff is scheduled for next Monday.",
    },
    {
      id: SEED_IDS.messages.gammaMsg1,
      conversationId: SEED_IDS.conversations.gammaGeneral,
      senderId: SEED_IDS.users.charlie,
      content: "Confidential quantum research briefing notes are strictly internal.",
    },
  ];

  for (const m of messages) {
    await prisma.message.upsert({
      where: { id: m.id },
      update: { content: m.content },
      create: m,
    });
  }

  await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId: SEED_IDS.messages.alphaMsg1,
        userId: SEED_IDS.users.bob,
        emoji: "👍",
      },
    },
    update: {},
    create: {
      messageId: SEED_IDS.messages.alphaMsg1,
      userId: SEED_IDS.users.bob,
      emoji: "👍",
    },
  });
  console.log(`✓ Seeded ${messages.length} messages and reactions`);

  // 9. Folders & Folder Members
  const folders = [
    {
      id: SEED_IDS.folders.alphaPublic,
      workspaceId: SEED_IDS.workspaces.alpha,
      name: "Design Assets",
      visibility: "WORKSPACE",
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.folders.alphaRestricted,
      workspaceId: SEED_IDS.workspaces.alpha,
      name: "Executive Financials",
      visibility: "RESTRICTED",
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.folders.betaPublic,
      workspaceId: SEED_IDS.workspaces.beta,
      name: "Brand Collateral",
      visibility: "WORKSPACE",
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.folders.gammaRestricted,
      workspaceId: SEED_IDS.workspaces.gamma,
      name: "Black Vault",
      visibility: "RESTRICTED",
      createdById: SEED_IDS.users.charlie,
    },
  ];

  for (const f of folders) {
    await prisma.folder.upsert({
      where: { id: f.id },
      update: { name: f.name, visibility: f.visibility },
      create: f,
    });
  }

  // Restrict Executive Financials to Alice (Admin) and Diana (Member).
  // Bob is explicitly EXCLUDED.
  const folderMembers = [
    { folderId: SEED_IDS.folders.alphaRestricted, userId: SEED_IDS.users.diana },
    { folderId: SEED_IDS.folders.gammaRestricted, userId: SEED_IDS.users.charlie },
  ];

  for (const fm of folderMembers) {
    await prisma.folderMember.upsert({
      where: { folderId_userId: { folderId: fm.folderId, userId: fm.userId } },
      update: {},
      create: fm,
    });
  }
  console.log(`✓ Seeded ${folders.length} folders and folder access permissions`);

  // 10. Assets & Versions (Database fixtures only — no real cloud uploads)
  const assets = [
    {
      id: SEED_IDS.assets.alphaLogo,
      workspaceId: SEED_IDS.workspaces.alpha,
      folderId: SEED_IDS.folders.alphaPublic,
      name: "logo_vector.svg",
      uploadedById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.assets.alphaBudget,
      workspaceId: SEED_IDS.workspaces.alpha,
      folderId: SEED_IDS.folders.alphaRestricted,
      name: "q3_budget_confidential.pdf",
      uploadedById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.assets.betaPressRelease,
      workspaceId: SEED_IDS.workspaces.beta,
      folderId: SEED_IDS.folders.betaPublic,
      name: "press_release_draft.docx",
      uploadedById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.assets.gammaSchematic,
      workspaceId: SEED_IDS.workspaces.gamma,
      folderId: SEED_IDS.folders.gammaRestricted,
      name: "quantum_schematics_classified.png",
      uploadedById: SEED_IDS.users.charlie,
    },
  ];

  for (const a of assets) {
    await prisma.asset.upsert({
      where: { id: a.id },
      update: { name: a.name, folderId: a.folderId },
      create: a,
    });
  }

  const assetVersions = [
    {
      id: SEED_IDS.assetVersions.alphaLogoV1,
      assetId: SEED_IDS.assets.alphaLogo,
      version: 1,
      originalName: "logo_vector.svg",
      storedName: "seed-fixture-alpha-logo.svg",
      mimeType: "image/svg+xml",
      size: 12450,
      uploadedById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.assetVersions.alphaBudgetV1,
      assetId: SEED_IDS.assets.alphaBudget,
      version: 1,
      originalName: "q3_budget_confidential.pdf",
      storedName: "seed-fixture-alpha-budget.pdf",
      mimeType: "application/pdf",
      size: 542000,
      uploadedById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.assetVersions.betaPressReleaseV1,
      assetId: SEED_IDS.assets.betaPressRelease,
      version: 1,
      originalName: "press_release_draft.docx",
      storedName: "seed-fixture-beta-press.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 45000,
      uploadedById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.assetVersions.gammaSchematicV1,
      assetId: SEED_IDS.assets.gammaSchematic,
      version: 1,
      originalName: "quantum_schematics_classified.png",
      storedName: "seed-fixture-gamma-schematic.png",
      mimeType: "image/png",
      size: 1048576,
      uploadedById: SEED_IDS.users.charlie,
    },
  ];

  for (const av of assetVersions) {
    await prisma.assetVersion.upsert({
      where: { assetId_version: { assetId: av.assetId, version: av.version } },
      update: { originalName: av.originalName, mimeType: av.mimeType, size: av.size },
      create: av,
    });
  }
  console.log(`✓ Seeded ${assets.length} assets with versions (metadata fixtures)`);

  // 11. Documents & Assignees
  const documents = [
    {
      id: SEED_IDS.documents.alphaPrd,
      workspaceId: SEED_IDS.workspaces.alpha,
      title: "Product Requirements Specification",
      visibility: "WORKSPACE",
      createdById: SEED_IDS.users.alice,
    },
    {
      id: SEED_IDS.documents.gammaSecretSpec,
      workspaceId: SEED_IDS.workspaces.gamma,
      title: "Classified Project Falcon Architecture",
      visibility: "ASSIGNED",
      createdById: SEED_IDS.users.charlie,
    },
  ];

  for (const d of documents) {
    await prisma.document.upsert({
      where: { id: d.id },
      update: { title: d.title, visibility: d.visibility },
      create: d,
    });
  }

  await prisma.documentAssignee.upsert({
    where: {
      documentId_userId: {
        documentId: SEED_IDS.documents.gammaSecretSpec,
        userId: SEED_IDS.users.charlie,
      },
    },
    update: {},
    create: {
      documentId: SEED_IDS.documents.gammaSecretSpec,
      userId: SEED_IDS.users.charlie,
    },
  });
  console.log(`✓ Seeded ${documents.length} collaborative documents`);

  // 12. Notifications
  await prisma.notification.upsert({
    where: { id: SEED_IDS.notifications.bobWelcome },
    update: { title: "Welcome to Acme Product Team" },
    create: {
      id: SEED_IDS.notifications.bobWelcome,
      userId: SEED_IDS.users.bob,
      type: "WORKSPACE_INVITE",
      title: "Welcome to Acme Product Team",
      body: "Alice added you to Acme Product Team as a member.",
      link: `/workspaces/${SEED_IDS.workspaces.alpha}`,
    },
  });
  console.log("✓ Seeded notifications");

  console.log("🎉 Seed finished successfully! All records verified/upserted.");
}

// If invoked directly from CLI
if (process.argv[1]?.endsWith("seed.js")) {
  seed()
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      if (defaultPrisma) {
        const ownedPrisma = defaultPrisma;
        defaultPrisma = null;
        await ownedPrisma.$disconnect();
      }
    });
}
