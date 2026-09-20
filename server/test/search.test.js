import "dotenv/config";
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app.js";
import { signToken } from "../src/utils/jwt.js";
import { clearPrismaClient, prisma, setPrismaClient } from "../src/db/prisma.js";
import { seed, SEED_IDS } from "../prisma/seed.js";

describe("Global Search & Database Seed Test Suite", () => {
  let server;
  let baseUrl;
  let testPrisma;
  let originalAllowDevSeed;

  // Pre-signed tokens for deterministic seeded users
  const tokenAlice = signToken({ sub: SEED_IDS.users.alice }); // Alpha (Admin), Beta (Admin)
  const tokenBob = signToken({ sub: SEED_IDS.users.bob }); // Alpha (Member only, NOT in restricted folder)
  const tokenCharlie = signToken({ sub: SEED_IDS.users.charlie }); // Gamma (Admin only)
  const tokenDiana = signToken({ sub: SEED_IDS.users.diana }); // Alpha (Member, IN restricted folder)

  before(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL?.trim();
    if (!testDbUrl) {
      throw new Error(
        "TEST_DATABASE_URL is not configured. Automated integration tests fail closed to protect development and production databases. Set TEST_DATABASE_URL to an isolated test database or Neon test branch."
      );
    }

    const defaultDbUrl = process.env.DATABASE_URL?.trim();
    if (defaultDbUrl && testDbUrl === defaultDbUrl) {
      throw new Error(
        "TEST_DATABASE_URL must not equal DATABASE_URL. Integration tests require an isolated test database to prevent accidental test data pollution on primary databases."
      );
    }

    // Explicit opt-in for the development fixtures within the isolated test environment.
    originalAllowDevSeed = process.env.ALLOW_DEV_SEED;
    process.env.ALLOW_DEV_SEED = "true";

    // This suite owns one client that is pinned directly to TEST_DATABASE_URL.
    // DATABASE_URL remains unchanged, so imported application modules cannot
    // accidentally redirect the development singleton after construction.
    testPrisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    setPrismaClient(testPrisma);
    await testPrisma.$connect();
    await seed(testPrisma);

    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/search`;
  });

  after(async () => {
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    } finally {
      try {
        if (testPrisma) {
          clearPrismaClient(testPrisma);
          await testPrisma.$disconnect();
          testPrisma = null;
        }
      } finally {
        if (originalAllowDevSeed === undefined) {
          delete process.env.ALLOW_DEV_SEED;
        } else {
          process.env.ALLOW_DEV_SEED = originalAllowDevSeed;
        }
      }
    }
  });

  it("1. Unauthenticated request is rejected with HTTP 401", async () => {
    const res = await fetch(`${baseUrl}?q=test`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /Missing authentication token/i);
  });

  it("2. Missing query parameter returns valid empty results", async () => {
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, "");
    assert.deepEqual(body.results.tasks, []);
    assert.deepEqual(body.results.messages, []);
    assert.deepEqual(body.results.assets, []);
    assert.deepEqual(body.results.users, []);
  });

  it("3. Empty query parameter returns valid empty results", async () => {
    const res = await fetch(`${baseUrl}?q=`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, "");
    assert.deepEqual(body.results.tasks, []);
  });

  it("4. Whitespace-only query is trimmed and returns empty results", async () => {
    const res = await fetch(`${baseUrl}?q=%20%20%20`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, "");
    assert.deepEqual(body.results.tasks, []);
  });

  it("5. Matching Task is returned with expected metadata", async () => {
    const res = await fetch(`${baseUrl}?q=Navigation`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, "Navigation");
    assert.ok(body.results.tasks.length >= 1);
    const navTask = body.results.tasks.find((t) => t.id === SEED_IDS.tasks.alphaNav);
    assert.ok(navTask, "Task 'Design Navigation System' should be found");
    assert.equal(navTask.title, "Design Navigation System");
    assert.equal(navTask.workspaceName, "Acme Product Team");
    assert.ok(navTask.assignee, "Task assignee should be serialized");
    assert.equal(navTask.assignee.name, "Bob Smith");
  });

  it("6. Matching Message is returned with conversation context", async () => {
    const res = await fetch(`${baseUrl}?q=sprint`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.results.messages.length >= 1);
    const msg = body.results.messages.find((m) => m.id === SEED_IDS.messages.alphaMsg1);
    assert.ok(msg, "Message should be found");
    assert.match(msg.content, /Welcome team to the Acme product sprint/i);
    assert.equal(msg.sender.name, "Alice Walker");
    assert.equal(msg.conversationTitle, "General");
  });

  it("7. Matching Asset is returned with folder and version metadata", async () => {
    const res = await fetch(`${baseUrl}?q=logo_vector`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.results.assets.length >= 1);
    const asset = body.results.assets.find((a) => a.id === SEED_IDS.assets.alphaLogo);
    assert.ok(asset, "Asset logo_vector.svg should be found");
    assert.equal(asset.name, "logo_vector.svg");
    assert.equal(asset.folderName, "Design Assets");
    assert.equal(asset.latestVersion?.mimeType, "image/svg+xml");
  });

  it("8. Matching User is returned with public fields only", async () => {
    const res = await fetch(`${baseUrl}?q=Smith`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.results.users.length >= 1);
    const user = body.results.users.find((u) => u.id === SEED_IDS.users.bob);
    assert.ok(user, "User Bob Smith should be found");
    assert.equal(user.name, "Bob Smith");
    assert.equal(user.email, "bob@loft.test");
  });

  it("9. Matching is case-insensitive (navigation vs NAVIGATION)", async () => {
    const resLower = await fetch(`${baseUrl}?q=navigation`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const resUpper = await fetch(`${baseUrl}?q=NAVIGATION`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const bodyLower = await resLower.json();
    const bodyUpper = await resUpper.json();

    assert.equal(bodyLower.results.tasks.length, bodyUpper.results.tasks.length);
    assert.ok(bodyLower.results.tasks.some((t) => t.id === SEED_IDS.tasks.alphaNav));
    assert.ok(bodyUpper.results.tasks.some((t) => t.id === SEED_IDS.tasks.alphaNav));
  });

  it("10. No-result query returns a valid empty response", async () => {
    const res = await fetch(`${baseUrl}?q=NonExistentTermXYZ9999`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, "NonExistentTermXYZ9999");
    assert.deepEqual(body.results.tasks, []);
    assert.deepEqual(body.results.messages, []);
    assert.deepEqual(body.results.assets, []);
    assert.deepEqual(body.results.users, []);
  });

  it("11. Results are limited to category limits (at most 10 per category)", async () => {
    const res = await fetch(`${baseUrl}?q=e`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.results.tasks.length <= 10);
    assert.ok(body.results.messages.length <= 10);
    assert.ok(body.results.assets.length <= 10);
    assert.ok(body.results.users.length <= 10);
  });

  it("12. User belonging to Workspace Alpha CANNOT retrieve data exclusively belonging to Workspace Gamma", async () => {
    // Bob belongs ONLY to Workspace Alpha.
    // Workspace Gamma has: Task 'Top Secret Quantum Architecture', Message 'quantum research', User Charlie
    const res = await fetch(`${baseUrl}?q=Quantum`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    // Bob must see ZERO results for Gamma tasks, messages, assets, or users
    assert.deepEqual(body.results.tasks, [], "Bob should not see Gamma tasks");
    assert.deepEqual(body.results.messages, [], "Bob should not see Gamma messages");
    assert.deepEqual(body.results.assets, [], "Bob should not see Gamma assets");
    assert.deepEqual(body.results.users, [], "Bob should not see Charlie (Gamma exclusive)");
  });

  it("13. Cross-workspace search works when the user legitimately belongs to multiple workspaces", async () => {
    // Alice belongs to BOTH Workspace Alpha and Workspace Beta.
    // Searching for tasks should return tasks from Alpha AND Beta.
    const res = await fetch(`${baseUrl}?q=Launch`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const body = await res.json();
    const betaTask = body.results.tasks.find((t) => t.id === SEED_IDS.tasks.betaMarketing);
    assert.ok(betaTask, "Alice should find Beta's 'Q4 Marketing Campaign Launch' task");
    assert.equal(betaTask.workspaceName, "Marketing & Growth");

    // But Bob (only in Alpha) searching for 'Launch' should NOT find Beta's task
    const resBob = await fetch(`${baseUrl}?q=Launch`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const bodyBob = await resBob.json();
    assert.ok(!bodyBob.results.tasks.some((t) => t.id === SEED_IDS.tasks.betaMarketing), "Bob must not see Beta task");
  });

  it("14. Restricted-folder assets are NOT returned to unauthorized workspace members", async () => {
    // 'q3_budget_confidential.pdf' is in 'Executive Financials' (RESTRICTED).
    // Bob is a member of Workspace Alpha, but NOT in this restricted folder and NOT an ADMIN.
    const res = await fetch(`${baseUrl}?q=budget`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const budgetAsset = body.results.assets.find((a) => a.id === SEED_IDS.assets.alphaBudget);
    assert.equal(budgetAsset, undefined, "Bob must NOT see the restricted folder asset");
  });

  it("15. Authorized restricted-folder users CAN receive those asset results", async () => {
    // Alice is an ADMIN in Alpha -> CAN see restricted folder asset
    const resAlice = await fetch(`${baseUrl}?q=budget`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const bodyAlice = await resAlice.json();
    const aliceAsset = bodyAlice.results.assets.find((a) => a.id === SEED_IDS.assets.alphaBudget);
    assert.ok(aliceAsset, "Alice (Admin) should see restricted budget asset");
    assert.equal(aliceAsset.folderName, "Executive Financials");

    // Diana is a MEMBER but explicitly listed in FolderMember -> CAN see restricted folder asset
    const resDiana = await fetch(`${baseUrl}?q=budget`, {
      headers: { Authorization: `Bearer ${tokenDiana}` },
    });
    const bodyDiana = await resDiana.json();
    const dianaAsset = bodyDiana.results.assets.find((a) => a.id === SEED_IDS.assets.alphaBudget);
    assert.ok(dianaAsset, "Diana (FolderMember) should see restricted budget asset");
  });

  it("16. Search does NOT expose sensitive User fields", async () => {
    const res = await fetch(`${baseUrl}?q=Alice`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const body = await res.json();
    assert.ok(body.results.users.length >= 1);
    for (const u of body.results.users) {
      assert.equal(u.passwordHash, undefined, "passwordHash must not be exposed");
      assert.equal(u.resetToken, undefined, "resetToken must not be exposed");
      assert.equal(u.resetTokenExpiry, undefined, "resetTokenExpiry must not be exposed");
      assert.equal(u.passwordChangeCode, undefined, "passwordChangeCode must not be exposed");
      assert.equal(u.googleId, undefined, "googleId must not be exposed");
    }
  });

  it("17. Special characters and long strings do not break the endpoint", async () => {
    // Special symbols
    const resSpecial = await fetch(`${baseUrl}?q=${encodeURIComponent("!@#$%^&*()_+~`{}|:<>?[];',./")}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(resSpecial.status, 200);
    const bodySpecial = await resSpecial.json();
    assert.deepEqual(bodySpecial.results.tasks, []);

    // Overly long query (>100 chars) should return 400 Bad Request
    const longQuery = "a".repeat(101);
    const resLong = await fetch(`${baseUrl}?q=${longQuery}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert.equal(resLong.status, 400);
    const bodyLong = await resLong.json();
    assert.match(bodyLong.error, /Search query is too long/i);
  });

  it("18. Repeated seed execution does not unexpectedly duplicate deterministic fixtures", async () => {
    // Count records before re-seeding
    const [userCountBefore, wsCountBefore, taskCountBefore] = await Promise.all([
      prisma.user.count({ where: { email: { in: ["alice@loft.test", "bob@loft.test", "charlie@loft.test", "diana@loft.test"] } } }),
      prisma.workspace.count({ where: { inviteCode: { in: ["ALPHA-DEV-INVITE", "BETA-DEV-INVITE", "GAMMA-DEV-INVITE"] } } }),
      prisma.task.count({ where: { id: { in: Object.values(SEED_IDS.tasks) } } }),
    ]);

    // Re-run seed
    await seed(testPrisma);

    // Count records after re-seeding
    const [userCountAfter, wsCountAfter, taskCountAfter] = await Promise.all([
      prisma.user.count({ where: { email: { in: ["alice@loft.test", "bob@loft.test", "charlie@loft.test", "diana@loft.test"] } } }),
      prisma.workspace.count({ where: { inviteCode: { in: ["ALPHA-DEV-INVITE", "BETA-DEV-INVITE", "GAMMA-DEV-INVITE"] } } }),
      prisma.task.count({ where: { id: { in: Object.values(SEED_IDS.tasks) } } }),
    ]);

    assert.equal(userCountBefore, 4);
    assert.equal(userCountAfter, 4);
    assert.equal(wsCountBefore, 3);
    assert.equal(wsCountAfter, 3);
    assert.equal(taskCountBefore, 4);
    assert.equal(taskCountAfter, 4);
  });

  it("19. Asset search regression: finds authorized assets even when >30 restricted matching assets exist earlier", async () => {
    // Generate 32 restricted assets in Alpha's restricted folder (inaccessible to Bob)
    const restrictedFolderId = SEED_IDS.folders.alphaRestricted;
    const publicFolderId = SEED_IDS.folders.alphaPublic;
    const workspaceId = SEED_IDS.workspaces.alpha;

    const createdIds = [];
    try {
      // 32 restricted assets with newer timestamps
      for (let i = 0; i < 32; i++) {
        const id = `90000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        createdIds.push(id);
        await prisma.asset.create({
          data: {
            id,
            workspaceId,
            folderId: restrictedFolderId,
            name: `overflow_test_asset_restricted_${i}.pdf`,
            uploadedById: SEED_IDS.users.alice,
            updatedAt: new Date(Date.now() + 1000 + i * 10),
            versions: {
              create: {
                version: 1,
                originalName: `overflow_test_asset_restricted_${i}.pdf`,
                storedName: `seed-overflow-restricted-${i}.pdf`,
                mimeType: "application/pdf",
                size: 1000,
                uploadedById: SEED_IDS.users.alice,
              },
            },
          },
        });
      }

      // 3 public assets with older timestamps (which would have been pushed beyond take: 30 in the old code)
      for (let i = 0; i < 3; i++) {
        const id = `90000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
        createdIds.push(id);
        await prisma.asset.create({
          data: {
            id,
            workspaceId,
            folderId: publicFolderId,
            name: `overflow_test_asset_public_${i}.pdf`,
            uploadedById: SEED_IDS.users.alice,
            updatedAt: new Date(Date.now() - 50000 - i * 10),
            versions: {
              create: {
                version: 1,
                originalName: `overflow_test_asset_public_${i}.pdf`,
                storedName: `seed-overflow-public-${i}.pdf`,
                mimeType: "application/pdf",
                size: 2000,
                uploadedById: SEED_IDS.users.alice,
              },
            },
          },
        });
      }

      // Query as Bob (who has NO access to the restricted folder)
      const resBob = await fetch(`${baseUrl}?q=overflow_test_asset`, {
        headers: { Authorization: `Bearer ${tokenBob}` },
      });
      assert.equal(resBob.status, 200);
      const bodyBob = await resBob.json();

      // Bob MUST receive the 3 public assets, not 0
      assert.equal(bodyBob.results.assets.length, 3, "Bob should find all 3 public matching assets");
      for (const a of bodyBob.results.assets) {
        assert.ok(a.name.includes("public"), "Bob must only receive public assets");
        assert.equal(a.folderName, "Design Assets");
      }

      // Query as Alice (Admin, has access to both public and restricted folders)
      const resAlice = await fetch(`${baseUrl}?q=overflow_test_asset`, {
        headers: { Authorization: `Bearer ${tokenAlice}` },
      });
      assert.equal(resAlice.status, 200);
      const bodyAlice = await resAlice.json();
      // Alice receives exactly 10 results (capped at CATEGORY_LIMIT)
      assert.equal(bodyAlice.results.assets.length, 10, "Alice should receive up to CATEGORY_LIMIT (10) assets");
    } finally {
      // Clean up temporary regression fixtures
      if (createdIds.length > 0) {
        await prisma.asset.deleteMany({ where: { id: { in: createdIds } } });
      }
    }
  });

  it("20. Seed production guard: refuses execution when NODE_ENV=production", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      await assert.rejects(
        async () => {
          await seed(testPrisma);
        },
        /Refusing to run development seed in production environment/i
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
