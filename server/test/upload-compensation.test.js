import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { clearPrismaClient, setPrismaClient } from "../src/db/prisma.js";
import * as assetsController from "../src/controllers/assets.controller.js";
import { uploadWithCompensation } from "../src/services/uploadCompensation.js";
import { errorHandler } from "../src/middleware/error.js";
import { resetErrorSinkForTests, setErrorSinkForTests } from "../src/utils/logger.js";
import { resetStorageForTests, setS3ClientForTests } from "../src/utils/uploads.js";

const STORAGE_ENV = ["AWS_REGION", "AWS_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3"];
const savedEnv = {};
const pdfBuffer = Buffer.from("%PDF-1.7\nphase-2a-test");

function configureFakeStorage() {
  process.env.AWS_REGION = "ap-southeast-1";
  process.env.AWS_S3_BUCKET = "loft-test-private";
  process.env.AWS_ACCESS_KEY_ID = "fake-access";
  process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
  delete process.env.AWS_ENDPOINT_URL_S3;
}

function uploadedFile() {
  return {
    originalname: "report.pdf",
    mimetype: "application/pdf",
    buffer: pdfBuffer,
    size: pdfBuffer.length,
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function baseAsset(versions = []) {
  return {
    id: "asset",
    workspaceId: "ws",
    folderId: null,
    taskId: null,
    name: "report.pdf",
    uploadedById: "owner",
    uploadedBy: { id: "owner", name: "Owner", avatarColor: "#000000" },
    versions,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function versionRecord(version, storedName) {
  return {
    id: `version-${version}`,
    assetId: "asset",
    version,
    originalName: "report.pdf",
    storedName,
    mimeType: "application/pdf",
    size: pdfBuffer.length,
    uploadedById: "owner",
    uploadedBy: { id: "owner", name: "Owner", avatarColor: "#000000" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function commandLogClient({ failPut = false, failDelete = false } = {}) {
  const commands = [];
  return {
    commands,
    client: {
      async send(command) {
        commands.push(command);
        if (command.constructor.name === "PutObjectCommand" && failPut) throw new Error("put failed");
        if (command.constructor.name === "DeleteObjectCommand" && failDelete) throw new Error("delete failed");
      },
    },
  };
}

before(() => {
  for (const key of STORAGE_ENV) savedEnv[key] = process.env[key];
  configureFakeStorage();
});

after(() => {
  resetStorageForTests();
  resetErrorSinkForTests();
  for (const key of STORAGE_ENV) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("upload compensation", () => {
  it("does not run the database operation when S3 upload fails", async () => {
    const { client, commands } = commandLogClient({ failPut: true });
    setS3ClientForTests(client);
    let persisted = false;
    await assert.rejects(
      uploadWithCompensation({
        workspaceId: "ws",
        storedName: "new-object",
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        operationType: "workspace_asset",
        persist: async () => {
          persisted = true;
        },
      }),
      /put failed/
    );
    assert.equal(persisted, false);
    assert.deepEqual(commands.map((command) => command.constructor.name), ["PutObjectCommand"]);
  });

  it("deletes only the new object and preserves the original database error", async () => {
    const { client, commands } = commandLogClient();
    setS3ClientForTests(client);
    const databaseError = Object.assign(new Error("insert failed"), { code: "P2025" });
    let received;
    try {
      await uploadWithCompensation({
        workspaceId: "ws",
        storedName: "new-object",
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        operationType: "workspace_asset",
        persist: async () => {
          throw databaseError;
        },
      });
    } catch (error) {
      received = error;
    }
    assert.equal(received, databaseError);
    assert.deepEqual(
      commands.map((command) => [command.constructor.name, command.input.Key]),
      [
        ["PutObjectCommand", "ws/new-object"],
        ["DeleteObjectCommand", "ws/new-object"],
      ]
    );
    assert.ok(!commands.some((command) => command.input.Key === "ws/pre-existing"));
  });

  it("logs safe structured identifiers and returns a safe error when cleanup fails", async () => {
    const { client } = commandLogClient({ failDelete: true });
    setS3ClientForTests(client);
    const logs = [];
    setErrorSinkForTests((entry) => logs.push(entry));
    const sensitiveText = "%PDF secret-content AKIA1234567890123456 postgresql://user:password@host/database";
    const databaseError = Object.assign(new Error(sensitiveText), { name: "PrismaClientKnownRequestError", code: "P2002" });

    let received;
    try {
      await uploadWithCompensation({
        workspaceId: "workspace-safe-id",
        storedName: "generated-object-id",
        buffer: pdfBuffer,
        mimeType: "application/pdf",
        operationType: "chat_attachment",
        persist: async () => {
          throw databaseError;
        },
      });
    } catch (error) {
      received = error;
    }

    assert.equal(received.statusCode, 500);
    assert.equal(received.message, "File upload could not be completed");
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0], {
      level: "error",
      event: "storage.upload_compensation_failed",
      workspaceId: "workspace-safe-id",
      objectName: "generated-object-id",
      operationType: "chat_attachment",
      databaseError: { name: "PrismaClientKnownRequestError", code: "P2002" },
      cleanupError: { name: "Error", code: "STORAGE_DELETE_FAILED" },
    });
    const serializedLog = JSON.stringify(logs[0]);
    assert.ok(!serializedLog.includes("secret-content"));
    assert.ok(!serializedLog.includes("AKIA"));
    assert.ok(!serializedLog.includes("postgresql://"));

    const response = responseRecorder();
    errorHandler(received, {}, response, () => {});
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: "File upload could not be completed", details: undefined });
    resetErrorSinkForTests();
  });

  it("uses compensation for workspace, task, chat, and version upload flows", async () => {
    const flows = [
      {
        name: "workspace",
        fake: () => ({ asset: { create: async () => { throw Object.assign(new Error("db failed"), { code: "P2025" }); } } }),
        invoke: (res) =>
          assetsController.uploadAsset(
            { params: { workspaceId: "ws" }, body: {}, file: uploadedFile(), userId: "owner", membership: { role: "MEMBER", permissions: "" } },
            res
          ),
      },
      {
        name: "task",
        fake: () => ({
          task: { findUnique: async () => ({ id: "task", workspaceId: "ws" }) },
          asset: { create: async () => { throw Object.assign(new Error("db failed"), { code: "P2025" }); } },
        }),
        invoke: (res) =>
          assetsController.uploadTaskAttachment(
            { params: { workspaceId: "ws", taskId: "task" }, body: {}, file: uploadedFile(), userId: "owner" },
            res
          ),
      },
      {
        name: "chat",
        fake: () => ({
          conversation: { findUnique: async () => ({ id: "conversation", workspaceId: "ws" }) },
          conversationParticipant: { findUnique: async () => ({ id: "participant" }) },
          folder: { findUnique: async () => ({ id: "chat-folder" }) },
          asset: { create: async () => { throw Object.assign(new Error("db failed"), { code: "P2025" }); } },
        }),
        invoke: (res) =>
          assetsController.uploadChatAttachment(
            {
              params: { workspaceId: "ws" },
              body: { conversationId: "conversation" },
              file: uploadedFile(),
              userId: "owner",
            },
            res
          ),
      },
      {
        name: "version",
        fake: () => ({
          asset: { findUnique: async () => baseAsset([versionRecord(1, "pre-existing")]) },
          $transaction: async () => { throw Object.assign(new Error("db failed"), { code: "P2025" }); },
        }),
        invoke: (res) =>
          assetsController.uploadVersion(
            {
              params: { workspaceId: "ws", assetId: "asset" },
              file: uploadedFile(),
              userId: "owner",
              membership: { role: "MEMBER", permissions: "" },
            },
            res
          ),
      },
    ];

    for (const flow of flows) {
      const fake = flow.fake();
      const { client, commands } = commandLogClient();
      setPrismaClient(fake);
      setS3ClientForTests(client);
      await assert.rejects(flow.invoke(responseRecorder()), (error) => error.code === "P2025", flow.name);
      const puts = commands.filter((command) => command.constructor.name === "PutObjectCommand");
      const deletes = commands.filter((command) => command.constructor.name === "DeleteObjectCommand");
      assert.equal(puts.length, 1, flow.name);
      assert.equal(deletes.length, 1, flow.name);
      assert.equal(deletes[0].input.Key, puts[0].input.Key, flow.name);
      assert.notEqual(deletes[0].input.Key, "ws/pre-existing", flow.name);
      clearPrismaClient(fake);
    }
  });
});

describe("version upload concurrency", () => {
  it("retries conflicts with fresh keys and leaves no known orphan objects", async () => {
    configureFakeStorage();
    const committedVersions = [versionRecord(1, "pre-existing")];
    let initialReaders = 0;
    let releaseInitialReaders;
    const initialReadBarrier = new Promise((resolve) => {
      releaseInitialReaders = resolve;
    });
    const transactionOptions = [];

    const fake = {
      asset: { findUnique: async () => baseAsset([...committedVersions]) },
      realtimeEvent: { create: async () => ({}) },
      $transaction: async (operation, options) => {
        transactionOptions.push(options);
        const tx = {
          assetVersion: {
            findFirst: async () => {
              initialReaders += 1;
              if (initialReaders <= 2) {
                if (initialReaders === 2) releaseInitialReaders();
                await initialReadBarrier;
                return { version: 1 };
              }
              return { version: Math.max(...committedVersions.map((version) => version.version)) };
            },
            create: async ({ data }) => {
              if (committedVersions.some((version) => version.version === data.version)) {
                throw Object.assign(new Error("version conflict"), { code: "P2002" });
              }
              committedVersions.push({ ...versionRecord(data.version, data.storedName), ...data });
            },
          },
          asset: { update: async () => baseAsset([...committedVersions]) },
        };
        return operation(tx);
      },
    };

    const liveObjects = new Set();
    const putKeys = [];
    const deleteKeys = [];
    setS3ClientForTests({
      async send(command) {
        if (command.constructor.name === "PutObjectCommand") {
          putKeys.push(command.input.Key);
          liveObjects.add(command.input.Key);
        } else if (command.constructor.name === "DeleteObjectCommand") {
          deleteKeys.push(command.input.Key);
          liveObjects.delete(command.input.Key);
        }
      },
    });
    setPrismaClient(fake);

    const request = () => ({
      params: { workspaceId: "ws", assetId: "asset" },
      file: uploadedFile(),
      userId: "owner",
      membership: { role: "MEMBER", permissions: "" },
    });
    const responses = [responseRecorder(), responseRecorder()];
    await Promise.all([
      assetsController.uploadVersion(request(), responses[0]),
      assetsController.uploadVersion(request(), responses[1]),
    ]);

    assert.deepEqual(committedVersions.map((version) => version.version).sort((a, b) => a - b), [1, 2, 3]);
    assert.equal(new Set(putKeys).size, 3);
    assert.equal(deleteKeys.length, 1);
    assert.ok(putKeys.includes(deleteKeys[0]));
    assert.notEqual(deleteKeys[0], "ws/pre-existing");
    assert.equal(liveObjects.size, 2);
    const referencedKeys = committedVersions.slice(1).map((version) => `ws/${version.storedName}`).sort();
    assert.deepEqual([...liveObjects].sort(), referencedKeys);
    assert.ok(transactionOptions.every((options) => options.isolationLevel === "Serializable"));
    assert.ok(responses.every((response) => response.statusCode === 201));
    clearPrismaClient(fake);
  });
});
