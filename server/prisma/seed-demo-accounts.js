import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { uploadObject, isStorageConfigured } from "../src/utils/uploads.js";
import { splitName } from "../src/utils/userName.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const outputDirectory = new URL("../.seed-accounts/", import.meta.url);
const manifestPath = new URL("accounts.json", outputDirectory);
const colors = ["#5B5BD6", "#2A9D8F", "#E76F51", "#3D8BFD"];

export function fixtureId(label) {
  const hex = createHash("sha256").update(`loft-demo-32-v1:${label}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildDemoFixtures(now = new Date()) {
  const data = { users: [], workspace: [], workspaceMember: [], taskStatus: [], task: [], conversation: [], conversationParticipant: [], message: [], folder: [], files: [] };
  for (let group = 1; group <= 4; group++) {
    const admin = { id: fixtureId(`admin-${group}`), email: `demo.admin${group}@loft.test`, name: `Demo Team ${group} Admin`, group, role: "ADMIN", avatarColor: colors[group - 1] };
    const members = Array.from({ length: 7 }, (_, index) => {
      const number = (group - 1) * 7 + index + 1;
      return { id: fixtureId(`member-${number}`), email: `demo.member${String(number).padStart(2, "0")}@loft.test`, name: `Demo Member ${String(number).padStart(2, "0")}`, group, role: "MEMBER", avatarColor: colors[group - 1] };
    });
    const people = [admin, ...members];
    data.users.push(...people);
    for (let project = 1; project <= 2; project++) {
      const key = `group-${group}-project-${project}`;
      const workspaceId = fixtureId(key);
      const workspaceName = `Demo Team ${group} - ${project === 1 ? "Product" : "Operations"}`;
      data.workspace.push({ id: workspaceId, name: workspaceName, description: `Populated test workspace for admin ${group} and their seven members.`, type: "work", color: colors[group - 1], inviteCode: fixtureId(`${key}-invite`), ownerId: admin.id });
      for (const person of people) data.workspaceMember.push({ id: fixtureId(`${key}-${person.id}-membership`), workspaceId, userId: person.id, role: person.role, permissions: "", title: person.role === "ADMIN" ? "Team administrator" : null });
      const statuses = ["To do", "In progress", "Completed"].map((label, index) => ({ id: fixtureId(`${key}-status-${index}`), workspaceId, label, color: ["#8a8578", "#3b82f6", "#10b981"][index], order: index, isDone: index === 2 }));
      data.taskStatus.push(...statuses);
      for (const [index, person] of people.entries()) {
        for (let task = 0; task < 3; task++) {
          data.task.push({ id: fixtureId(`${key}-${person.id}-task-${task}`), workspaceId, title: `${["Prepare delivery checklist", "Review project milestones", "Complete onboarding review"][task]} - ${person.name}`, description: `Test assignment for ${workspaceName}. Review the shared reference files and post an update in the Delivery channel.`, tier: ["TIER_1", "TIER_2", "TIER_3", "TIER_4"][(index + task) % 4], status: statuses[task].id, assigneeId: person.id, createdById: admin.id, estimatedMinutes: [30, 60, 45][task], order: index * 3 + task, dueDate: new Date(now.getTime() + (task + project + index % 3) * 86400000) });
        }
      }
      for (const [channelIndex, title] of ["General", "Delivery"].entries()) {
        const conversationId = fixtureId(`${key}-channel-${channelIndex}`);
        data.conversation.push({ id: conversationId, workspaceId, title, isGroup: true, isDefault: channelIndex === 0, createdById: admin.id });
        for (const [index, person] of people.entries()) {
          data.conversationParticipant.push({ id: fixtureId(`${conversationId}-${person.id}`), conversationId, userId: person.id, lastReadAt: new Date(now.getTime() - 86400000) });
          data.message.push({ id: fixtureId(`${conversationId}-message-${index}`), conversationId, senderId: person.id, content: index === 0 ? `Welcome to ${workspaceName}! Our reference files are in Shared references. Please review your tasks and share progress here.` : `${person.name}: ${channelIndex === 0 ? "I have reviewed the team brief and my assignments." : "My delivery checklist is underway. I will share blockers before the milestone review."}`, createdAt: new Date(now.getTime() - (people.length - index) * 60000) });
        }
      }
      const folderId = fixtureId(`${key}-folder`);
      data.folder.push({ id: folderId, workspaceId, name: "Shared references", visibility: "WORKSPACE", createdById: admin.id });
      for (const [fileIndex, name] of ["team-brief.txt", "delivery-checklist.csv", "meeting-notes.txt"].entries()) {
        const content = fileIndex === 0 ? `${workspaceName}\n\nAdministrator: ${admin.name}\nMembers:\n${members.map((p) => `- ${p.name}`).join("\n")}\n\nObjective: deliver the project milestone, review task priorities, and report blockers.\n` : fileIndex === 1 ? "Item,Owner,Status\nReview requirements,Team,In progress\nValidate deliverables,Team,To do\nPrepare handover,Admin,To do\n" : `${workspaceName} - planning notes\n\nDecision: use the Delivery channel for progress updates.\nAction: each member reviews their tasks and prepares a checklist.\nAction: administrator reviews milestones and resolves blockers.\n`;
        const assetId = fixtureId(`${key}-file-${fileIndex}`);
        data.files.push({ asset: { id: assetId, workspaceId, folderId, name, uploadedById: admin.id }, version: { id: fixtureId(`${assetId}-v1`), assetId, version: 1, originalName: name, storedName: fixtureId(`${assetId}-object`), mimeType: fileIndex === 1 ? "text/csv" : "text/plain", size: Buffer.byteLength(content), uploadedById: admin.id }, content });
      }
    }
  }
  return data;
}

export async function prepareDemoAccounts(fixtures = buildDemoFixtures()) {
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  manifest ||= { version: 1, accounts: fixtures.users.map((p) => ({ ...p, password: `Loft!${randomBytes(15).toString("base64url")}` })) };
  if (manifest.version !== 1 || manifest.accounts.length !== 32 || fixtures.users.some((p) => !manifest.accounts.some((a) => a.id === p.id && a.email === p.email && typeof a.password === "string"))) throw new Error("Invalid local demo credentials manifest.");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const csv = ["Group,Role,Name,Email,Password,Workspaces", ...manifest.accounts.map((p) => [p.group, p.role, p.name, p.email, p.password, `Demo Team ${p.group} - Product / Operations`].join(","))].join("\n");
  await writeFile(new URL("accounts.csv", outputDirectory), `${csv}\n`);
  for (const file of fixtures.files) {
    const localFolder = new URL(`${file.asset.workspaceId}/`, outputDirectory);
    await mkdir(localFolder, { recursive: true });
    await writeFile(new URL(file.asset.name, localFolder), file.content);
  }
  return manifest;
}

export async function seedDemoAccounts() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo accounts cannot be seeded with NODE_ENV=production.");
  if (process.env.ALLOW_DEV_SEED !== "true") throw new Error("Set ALLOW_DEV_SEED=true to explicitly enable demo account creation.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const fixtures = buildDemoFixtures();
  const manifest = await prepareDemoAccounts(fixtures);
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findMany({ where: { OR: [{ id: { in: fixtures.users.map((p) => p.id) } }, { email: { in: fixtures.users.map((p) => p.email) } }] }, select: { id: true, email: true, passwordHash: true } });
    for (const user of existing) {
      const expected = fixtures.users.find((p) => p.email === user.email);
      const credential = manifest?.accounts?.find((p) => p.id === user.id);
      if (expected?.id !== user.id || !credential || credential.email !== user.email || !await bcrypt.compare(credential.password, user.passwordHash || "")) throw new Error("A demo identity already exists with different credentials. Refusing to replace it or reset passwords.");
    }
    const users = await Promise.all(fixtures.users.map(async ({ group, role, ...person }) => ({ ...person, ...splitName(person.name), passwordHash: await bcrypt.hash(manifest.accounts.find((p) => p.id === person.id).password, 10) })));
    // Add only these namespaced fixtures; preserve existing users and edits on rerun.
    await prisma.$transaction(async (tx) => {
      await tx.user.createMany({ data: users, skipDuplicates: true });
      for (const model of ["workspace", "workspaceMember", "taskStatus", "task", "conversation", "conversationParticipant", "message", "folder"]) await tx[model].createMany({ data: fixtures[model], skipDuplicates: true });
    }, { timeout: 120000 });
    let uploadedFiles = 0;
    for (const file of fixtures.files) {
      if (!isStorageConfigured()) continue;
      const saved = await prisma.assetVersion.findUnique({ where: { id: file.version.id } });
      if (!saved) {
        // Upload real bytes before publishing file metadata. Interrupted uploads
        // reuse the same fixture key on retry; no broken download placeholders.
        await uploadObject(file.asset.workspaceId, file.version.storedName, Buffer.from(file.content), file.version.mimeType);
        await prisma.$transaction(async (tx) => {
          await tx.asset.upsert({ where: { id: file.asset.id }, create: file.asset, update: {} });
          await tx.assetVersion.upsert({ where: { id: file.version.id }, create: file.version, update: {} });
        });
      }
      uploadedFiles++;
    }
    const counts = {
      users: await prisma.user.count({ where: { id: { in: fixtures.users.map((p) => p.id) } } }),
      workspaces: await prisma.workspace.count({ where: { id: { in: fixtures.workspace.map((p) => p.id) } } }),
      memberships: await prisma.workspaceMember.count({ where: { id: { in: fixtures.workspaceMember.map((p) => p.id) } } }),
      tasks: await prisma.task.count({ where: { id: { in: fixtures.task.map((p) => p.id) } } }),
      channels: await prisma.conversation.count({ where: { id: { in: fixtures.conversation.map((p) => p.id) } } }),
      messages: await prisma.message.count({ where: { id: { in: fixtures.message.map((p) => p.id) } } }),
      uploadedFiles,
    };
    console.log(JSON.stringify(counts));
    console.log("Credentials: server/.seed-accounts/accounts.csv (gitignored)");
    if (uploadedFiles < fixtures.files.length) console.log("24 real sample files are staged locally. Configure object storage and rerun to publish them in LOFT.");
    return counts;
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const operation = process.argv.includes("--prepare") ? prepareDemoAccounts().then(() => console.log("Prepared 32 login credentials and 24 sample files locally; no database accounts created.")) : seedDemoAccounts();
  operation.catch((error) => {
    // Provider/Prisma errors can contain connection strings; keep CLI output safe.
    console.error("Demo seeding did not finish. Check database/storage configuration and local credentials; rerunning resumes without resetting accounts.");
    const safeCodes = ["P1000", "P1001", "P1002", "P1010", "P1012", "P2021", "P2022", "P2002", "P2003", "P2028"];
    const code = error.code || error.errorCode;
    if (safeCodes.includes(code)) console.error(`Database diagnostic: ${code}`);
    if (["PrismaClientInitializationError", "PrismaClientValidationError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError"].includes(error.name)) console.error(`Database error type: ${error.name}`);
    if (error.name === "PrismaClientInitializationError") {
      let diagnostic = error.message;
      const sensitive = Object.entries(process.env).filter(([key, value]) => /SECRET|TOKEN|PASSWORD|KEY|DATABASE_URL|DIRECT_URL/.test(key) && value?.length > 3).map(([, value]) => value);
      for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
        try { const url = new URL(process.env[key]); sensitive.push(url.hostname, url.username, url.password, decodeURIComponent(url.password)); } catch { /* no valid URL */ }
      }
      for (const value of sensitive.filter(Boolean).sort((a, b) => b.length - a.length)) diagnostic = diagnostic.replaceAll(value, "[redacted]");
      console.error(diagnostic.replace(/[a-z]+:\/\/[^\s"']+/gi, "[redacted URL]").slice(-1000));
    }
    process.exitCode = 1;
  });
}
