import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import JSZip from "jszip";

import { clearPrismaClient, setPrismaClient } from "../src/db/prisma.js";
import { isFolderVisible } from "../src/services/folderAccess.js";
import { purgeConversationAndAttachments } from "../src/services/conversationPurge.js";
import { MAX_UPLOAD_BYTES, normalizeUploadFilename, validateUploadedFile } from "../src/utils/uploadValidation.js";
import {
  deleteObject,
  isStorageConfigured,
  resetStorageForTests,
  setS3ClientForTests,
} from "../src/utils/uploads.js";
import * as assetsController from "../src/controllers/assets.controller.js";
import * as dashboardController from "../src/controllers/dashboard.controller.js";
import * as foldersController from "../src/controllers/folders.controller.js";
import * as searchController from "../src/controllers/search.controller.js";
import * as tasksController from "../src/controllers/tasks.controller.js";
import * as workspacesController from "../src/controllers/workspaces.controller.js";
import { errorHandler } from "../src/middleware/error.js";
import { requireStorageConfigured, singleFileUpload } from "../src/middleware/storageUpload.js";

const STORAGE_ENV = ["AWS_REGION", "AWS_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3"];
const savedEnv = {};

function configureFakeStorage() {
  process.env.AWS_REGION = "ap-southeast-1";
  process.env.AWS_S3_BUCKET = "loft-test-private";
  process.env.AWS_ACCESS_KEY_ID = "fake-access";
  process.env.AWS_SECRET_ACCESS_KEY = "fake-secret";
  delete process.env.AWS_ENDPOINT_URL_S3;
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

function file(name, mimetype, buffer) {
  return { originalname: name, mimetype, buffer, size: buffer.length };
}

function postMultipart(port, filename) {
  const boundary = "----loft-storage-safety";
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\n\r\n--${boundary}--\r\n`,
    "latin1"
  );
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/upload",
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": body.length,
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      }
    );
    request.on("error", reject);
    request.end(body);
  });
}

async function realOoxmlFixture(extension) {
  const definitions = {
    docx: ["word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"],
    xlsx: ["xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],
    pptx: ["ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"],
  };
  const [entry, contentType] = definitions[extension];
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${entry}" ContentType="${contentType}"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${entry}"/></Relationships>`
  );
  const mainXml = {
    docx: '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>',
    xlsx: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>',
    pptx: '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
  };
  zip.file(entry, mainXml[extension]);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

const signatures = {
  pdf: Buffer.from("%PDF-1.7\n"),
  text: Buffer.from("hello, world\n", "utf8"),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: Buffer.from("GIF89a"),
  webp: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]),
};

before(() => {
  for (const key of STORAGE_ENV) savedEnv[key] = process.env[key];
});

after(() => {
  resetStorageForTests();
  for (const key of STORAGE_ENV) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("folder authorization", () => {
  const membership = { role: "MEMBER", permissions: "" };
  const restricted = { id: "parent", parentId: null, visibility: "RESTRICTED", createdById: "owner", members: [] };
  const child = { id: "child", parentId: "parent", visibility: "WORKSPACE", createdById: "member", members: [] };
  const folders = new Map([[restricted.id, restricted], [child.id, child]]);

  it("requires access to every restricted ancestor", () => {
    assert.equal(isFolderVisible("member", membership, child, folders), false);
    assert.equal(isFolderVisible("owner", membership, child, folders), true);
    assert.equal(isFolderVisible("manager", { role: "MEMBER", permissions: "files.viewAll" }, child, folders), true);
  });

  it("fails closed on missing parents for ordinary and privileged users", () => {
    assert.equal(isFolderVisible("member", membership, child, new Map([[child.id, child]])), false);
    assert.equal(isFolderVisible("admin", { role: "ADMIN", permissions: "" }, child, new Map([[child.id, child]])), false);
    assert.equal(
      isFolderVisible("manager", { role: "MEMBER", permissions: "files.viewAll" }, child, new Map([[child.id, child]])),
      false
    );
  });

  it("fails closed on ancestry cycles for ordinary and privileged users", () => {
    const a = { id: "a", parentId: "b", visibility: "WORKSPACE", createdById: "member", members: [] };
    const b = { id: "b", parentId: "a", visibility: "WORKSPACE", createdById: "member", members: [] };
    const cyclic = new Map([[a.id, a], [b.id, b]]);
    assert.equal(isFolderVisible("member", membership, a, cyclic), false);
    assert.equal(isFolderVisible("admin", { role: "ADMIN", permissions: "" }, a, cyclic), false);
    assert.equal(isFolderVisible("manager", { role: "MEMBER", permissions: "files.viewAll" }, a, cyclic), false);
  });

  it("rejects a folder move into an inaccessible destination parent", async () => {
    const source = { id: "source", workspaceId: "ws", parentId: null, visibility: "WORKSPACE", createdById: "member", members: [] };
    const fake = {
      folder: {
        findMany: async () => [source, restricted],
        update: async () => assert.fail("folder update must not run"),
      },
    };
    setPrismaClient(fake);
    await assert.rejects(
      foldersController.updateFolder(
        { params: { workspaceId: "ws", folderId: source.id }, body: { parentId: restricted.id }, userId: "member", membership },
        responseRecorder()
      ),
      (err) => err.statusCode === 403
    );
    clearPrismaClient(fake);
  });

  it("rejects self and descendant folder moves before mutation", async () => {
    const source = { id: "source", workspaceId: "ws", parentId: null, visibility: "WORKSPACE", createdById: "member", members: [] };
    const descendant = { id: "descendant", workspaceId: "ws", parentId: source.id, visibility: "WORKSPACE", createdById: "member", members: [] };
    for (const parentId of [source.id, descendant.id]) {
      const fake = {
        folder: {
          findMany: async () => [source, descendant],
          update: async () => assert.fail("folder update must not run"),
        },
      };
      setPrismaClient(fake);
      await assert.rejects(
        foldersController.updateFolder(
          { params: { workspaceId: "ws", folderId: source.id }, body: { parentId }, userId: "member", membership },
          responseRecorder()
        ),
        (err) => err.statusCode === 400
      );
      clearPrismaClient(fake);
    }
  });

  it("rejects broken or cyclic destination ancestry for privileged users", async () => {
    const source = { id: "source", workspaceId: "ws", parentId: null, visibility: "WORKSPACE", createdById: "admin", members: [] };
    const broken = { id: "broken", workspaceId: "ws", parentId: "missing", visibility: "WORKSPACE", createdById: "admin", members: [] };
    const a = { id: "a", workspaceId: "ws", parentId: "b", visibility: "WORKSPACE", createdById: "admin", members: [] };
    const b = { id: "b", workspaceId: "ws", parentId: "a", visibility: "WORKSPACE", createdById: "admin", members: [] };
    for (const [destination, foldersForMove] of [[broken, [source, broken]], [a, [source, a, b]]]) {
      const fake = {
        folder: {
          findMany: async () => foldersForMove,
          update: async () => assert.fail("folder update must not run"),
        },
      };
      setPrismaClient(fake);
      await assert.rejects(
        foldersController.updateFolder(
          {
            params: { workspaceId: "ws", folderId: source.id },
            body: { parentId: destination.id },
            userId: "admin",
            membership: { role: "ADMIN", permissions: "" },
          },
          responseRecorder()
        ),
        (err) => err.statusCode === 400
      );
      clearPrismaClient(fake);
    }
  });
});

describe("upload validation", () => {
  const allowed = [
    ["file.pdf", "application/pdf", signatures.pdf],
    ["file.txt", "text/plain", signatures.text],
    ["file.md", "text/markdown", signatures.text],
    ["file.csv", "text/csv", signatures.text],
    ["file.jpg", "image/jpeg", signatures.jpeg],
    ["file.jpeg", "image/jpeg", signatures.jpeg],
    ["file.png", "image/png", signatures.png],
    ["file.gif", "image/gif", signatures.gif],
    ["file.webp", "image/webp", signatures.webp],
  ];

  it("accepts the approved extension, MIME, and signature combinations", async () => {
    for (const [name, mime, buffer] of allowed) {
      assert.equal((await validateUploadedFile(file(name, mime, buffer))).originalName, name);
    }
    for (const [extension, mime] of [
      ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ]) {
      const buffer = await realOoxmlFixture(extension);
      assert.equal((await validateUploadedFile(file(`file.${extension}`, mime, buffer))).extension, `.${extension}`);
    }
  });

  it("normalizes Unicode NFC and enforces safe UTF-8 filenames", () => {
    assert.equal(normalizeUploadFilename(" cafe\u0301.pdf "), "caf\u00e9.pdf");
    for (const name of [
      "../file.pdf",
      "folder/file.pdf",
      "folder\\file.pdf",
      "..%2ffile.pdf",
      "..%5Cfile.pdf",
      "..%252ffile.pdf",
      "folder\uFF0Ffile.pdf",
      "folder\uFF3Cfile.pdf",
      "bad\u0000.pdf",
      `${"é".repeat(126)}.pdf`,
    ]) {
      assert.throws(() => normalizeUploadFilename(name), (err) => err.statusCode === 400);
    }
  });

  it("rejects empty and oversized files", async () => {
    await assert.rejects(validateUploadedFile(file("empty.txt", "text/plain", Buffer.alloc(0))), (err) => err.statusCode === 400);
    const oversized = file("large.txt", "text/plain", Buffer.from("x"));
    oversized.size = MAX_UPLOAD_BYTES + 1;
    await assert.rejects(validateUploadedFile(oversized), (err) => err.statusCode === 413);
  });

  it("rejects MIME/signature mismatches and forbidden formats", async () => {
    await assert.rejects(
      validateUploadedFile(file("fake.pdf", "application/pdf", Buffer.from("not a pdf"))),
      (err) => err.statusCode === 415
    );
    await assert.rejects(
      validateUploadedFile(file("image.png", "image/jpeg", signatures.png)),
      (err) => err.statusCode === 415
    );
    for (const [name, mime] of [
      ["run.exe", "application/vnd.microsoft.portable-executable"],
      ["page.html", "text/html"],
      ["script.js", "text/javascript"],
      ["vector.svg", "image/svg+xml"],
      ["archive.zip", "application/zip"],
      ["sound.mp3", "audio/mpeg"],
      ["movie.mp4", "video/mp4"],
    ]) {
      await assert.rejects(validateUploadedFile(file(name, mime, Buffer.from("content"))), (err) => err.statusCode === 415);
    }
  });

  it("rejects active web payloads disguised as allowed text", async () => {
    for (const payload of [
      "<!doctype html><html><body>unsafe</body></html>",
      "<div>disguised HTML</div>",
      "<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>",
      "console.log('unsafe')",
      "alert('unsafe')",
      "(() => 'unsafe')()",
    ]) {
      await assert.rejects(
        validateUploadedFile(file("notes.txt", "text/plain", Buffer.from(payload))),
        (err) => err.statusCode === 415
      );
    }
    assert.equal(
      (await validateUploadedFile(file("notes.txt", "text/plain", Buffer.from("ordinary UTF-8 notes — safe")))).originalName,
      "notes.txt"
    );
  });

  it("rejects corrupt, pseudo-ZIP, and wrong-family OOXML", async () => {
    const pseudoZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml word/document.xml")]);
    await assert.rejects(
      validateUploadedFile(file("fake.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pseudoZip)),
      (err) => err.statusCode === 415
    );
    const xlsx = await realOoxmlFixture("xlsx");
    await assert.rejects(
      validateUploadedFile(file("fake.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx)),
      (err) => err.statusCode === 415
    );
    const corrupt = await realOoxmlFixture("docx");
    corrupt[Math.floor(corrupt.length / 3)] ^= 0xff;
    await assert.rejects(
      validateUploadedFile(file("corrupt.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", corrupt)),
      (err) => err.statusCode === 415
    );
  });

  it("maps Multer's size limit to HTTP 413", () => {
    const res = responseRecorder();
    errorHandler({ name: "MulterError", code: "LIMIT_FILE_SIZE" }, {}, res, () => {});
    assert.equal(res.statusCode, 413);
  });

  it("rejects path-bearing and encoded traversal filenames through multipart routing", async () => {
    configureFakeStorage();
    const app = express();
    app.post("/upload", requireStorageConfigured, singleFileUpload, (req, res, next) => {
      validateUploadedFile(req.file)
        .then(() => res.status(204).end())
        .catch(next);
    });
    app.use(errorHandler);
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    try {
      const { port } = server.address();
      for (const filename of ["../file.pdf", "folder\\file.pdf", "..%2ffile.pdf", "..%5Cfile.pdf"]) {
        assert.equal(await postMultipart(port, filename), 400);
      }
      assert.equal(await postMultipart(port, "safe.pdf"), 204);
    } finally {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});

describe("asset authorization", () => {
  it("allows version upload only to the uploader or files.manage", async () => {
    configureFakeStorage();
    const sent = [];
    setS3ClientForTests({ send: async (command) => sent.push(command) });
    const existing = {
      id: "asset",
      workspaceId: "ws",
      folderId: null,
      taskId: null,
      name: "file.pdf",
      uploadedById: "owner",
      uploadedBy: { id: "owner", name: "Owner", avatarColor: "#000" },
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fake = {
      asset: {
        findUnique: async () => existing,
        update: async () => existing,
      },
      assetVersion: { create: async () => ({}) },
      realtimeEvent: { create: async () => ({}) },
    };
    setPrismaClient(fake);

    const baseReq = { params: { workspaceId: "ws", assetId: "asset" }, file: file("file.pdf", "application/pdf", signatures.pdf) };
    await assert.rejects(
      assetsController.uploadVersion({ ...baseReq, userId: "viewer", membership: { role: "MEMBER", permissions: "" } }, responseRecorder()),
      (err) => err.statusCode === 403
    );
    assert.equal(sent.length, 0);

    for (const [userId, permissions] of [["owner", ""], ["manager", "files.manage"]]) {
      const res = responseRecorder();
      await assetsController.uploadVersion({ ...baseReq, userId, membership: { role: "MEMBER", permissions } }, res);
      assert.equal(res.statusCode, 201);
    }
    assert.equal(sent.length, 2);
    clearPrismaClient(fake);
  });

  it("requires files.manage for merge before reading asset metadata", async () => {
    const fake = { asset: { findUnique: async () => assert.fail("asset lookup must not run") } };
    setPrismaClient(fake);
    await assert.rejects(
      assetsController.mergeAssets(
        { params: { workspaceId: "ws", assetId: "target" }, body: { sourceAssetId: "source" }, membership: { role: "MEMBER", permissions: "" } },
        responseRecorder()
      ),
      (err) => err.statusCode === 403
    );
    clearPrismaClient(fake);
  });

  it("binds task-attachment deletion to the task in the URL", async () => {
    const fake = {
      asset: {
        findUnique: async () => ({ id: "asset", workspaceId: "ws", taskId: "task-a", uploadedById: "owner", folderId: null, versions: [] }),
        delete: async () => assert.fail("asset delete must not run"),
      },
    };
    setPrismaClient(fake);
    await assert.rejects(
      assetsController.deleteAsset(
        { params: { workspaceId: "ws", taskId: "task-b", assetId: "asset" }, userId: "owner", membership: { role: "MEMBER", permissions: "" } },
        responseRecorder()
      ),
      (err) => err.statusCode === 404
    );
    clearPrismaClient(fake);
  });

  it("never detaches an asset with a restricted ancestor to the workspace root", async () => {
    const restricted = { id: "restricted", workspaceId: "ws", parentId: null, visibility: "RESTRICTED", createdById: "owner", members: [] };
    const child = { id: "child", workspaceId: "ws", parentId: restricted.id, visibility: "WORKSPACE", createdById: "owner", members: [] };
    const asset = { id: "asset", workspaceId: "ws", folderId: child.id, uploadedById: "owner", chatMessages: [] };
    for (const [userId, membership] of [
      ["owner", { role: "MEMBER", permissions: "" }],
      ["manager", { role: "MEMBER", permissions: "files.manage,files.viewAll" }],
    ]) {
      const fake = {
        asset: {
          findUnique: async () => asset,
          update: async () => assert.fail("asset update must not run"),
        },
        folder: { findMany: async () => [restricted, child] },
      };
      setPrismaClient(fake);
      await assert.rejects(
        assetsController.moveAsset(
          { params: { workspaceId: "ws", assetId: asset.id }, body: { folderId: null }, userId, membership },
          responseRecorder()
        ),
        (err) => err.statusCode === 400
      );
      clearPrismaClient(fake);
    }
  });

  it("blocks chat attachments from general moves and ordinary files from managed chat folders", async () => {
    const chatFolder = {
      id: "chat-folder",
      workspaceId: "ws",
      parentId: null,
      visibility: "WORKSPACE",
      createdById: "owner",
      members: [],
      chatConversationId: "conversation",
    };
    const chatChild = {
      id: "chat-child",
      workspaceId: "ws",
      parentId: chatFolder.id,
      visibility: "WORKSPACE",
      createdById: "owner",
      members: [],
      chatConversationId: null,
    };
    const ordinary = { id: "ordinary", workspaceId: "ws", folderId: null, uploadedById: "owner", chatMessages: [] };
    const attached = { id: "attached", workspaceId: "ws", folderId: null, uploadedById: "owner", chatMessages: [{ id: "message" }] };
    const pending = { id: "pending", workspaceId: "ws", folderId: chatFolder.id, uploadedById: "owner", chatMessages: [] };
    for (const [asset, destination] of [
      [attached, null],
      [pending, null],
      [ordinary, chatFolder.id],
      [ordinary, chatChild.id],
    ]) {
      const fake = {
        asset: {
          findUnique: async () => asset,
          update: async () => assert.fail("asset update must not run"),
        },
        folder: { findMany: async () => [chatFolder, chatChild] },
      };
      setPrismaClient(fake);
      await assert.rejects(
        assetsController.moveAsset(
          {
            params: { workspaceId: "ws", assetId: asset.id },
            body: { folderId: destination },
            userId: "owner",
            membership: { role: "ADMIN", permissions: "" },
          },
          responseRecorder()
        ),
        (err) => err.statusCode === 400
      );
      clearPrismaClient(fake);
    }
  });

  it("blocks general uploads into managed chat-folder ancestry before S3", async () => {
    configureFakeStorage();
    const chatFolder = {
      id: "chat-folder",
      workspaceId: "ws",
      parentId: null,
      visibility: "WORKSPACE",
      createdById: "owner",
      members: [],
      chatConversationId: "conversation",
    };
    const child = {
      id: "child",
      workspaceId: "ws",
      parentId: chatFolder.id,
      visibility: "WORKSPACE",
      createdById: "owner",
      members: [],
      chatConversationId: null,
    };
    const sent = [];
    const fake = {
      folder: { findMany: async () => [chatFolder, child] },
      asset: { create: async () => assert.fail("asset create must not run") },
    };
    setPrismaClient(fake);
    setS3ClientForTests({ send: async (command) => sent.push(command) });
    await assert.rejects(
      assetsController.uploadAsset(
        {
          params: { workspaceId: "ws" },
          body: { folderId: child.id },
          file: file("file.pdf", "application/pdf", signatures.pdf),
          userId: "owner",
          membership: { role: "ADMIN", permissions: "" },
        },
        responseRecorder()
      ),
      (err) => err.statusCode === 400
    );
    assert.equal(sent.length, 0);
    clearPrismaClient(fake);
  });

  it("requires structurally valid and accessible asset destinations", async () => {
    const asset = { id: "asset", workspaceId: "ws", folderId: null, uploadedById: "owner", chatMessages: [] };
    const broken = { id: "broken", workspaceId: "ws", parentId: "missing", visibility: "WORKSPACE", createdById: "owner", members: [] };
    const restricted = { id: "restricted", workspaceId: "ws", parentId: null, visibility: "RESTRICTED", createdById: "other", members: [] };
    for (const [destination, membership, expectedStatus] of [
      [broken, { role: "ADMIN", permissions: "" }, 400],
      [restricted, { role: "MEMBER", permissions: "" }, 403],
    ]) {
      const fake = {
        asset: {
          findUnique: async () => asset,
          update: async () => assert.fail("asset update must not run"),
        },
        folder: { findMany: async () => [destination] },
      };
      setPrismaClient(fake);
      await assert.rejects(
        assetsController.moveAsset(
          {
            params: { workspaceId: "ws", assetId: asset.id },
            body: { folderId: destination.id },
            userId: "owner",
            membership,
          },
          responseRecorder()
        ),
        (err) => err.statusCode === expectedStatus
      );
      clearPrismaClient(fake);
    }
  });
});

describe("visibility and membership cleanup", () => {
  it("excludes task attachments from general asset listing", async () => {
    let assetWhere;
    const fake = {
      asset: { findMany: async ({ where }) => ((assetWhere = where), []) },
      folder: { findMany: async () => [] },
    };
    setPrismaClient(fake);
    await assetsController.listAssets(
      { params: { workspaceId: "ws" }, userId: "member", membership: { role: "MEMBER", permissions: "" } },
      responseRecorder()
    );
    assert.equal(assetWhere.taskId, null);
    clearPrismaClient(fake);
  });

  it("excludes task attachments from both dashboard asset queries", async () => {
    const assetWheres = [];
    const fake = {
      workspace: { findMany: async () => [] },
      workspaceMember: { findMany: async () => [] },
      taskStatus: { findMany: async () => [] },
      task: { findMany: async () => [] },
      event: { findMany: async () => [] },
      message: { findMany: async () => [] },
      notification: { findMany: async () => [], count: async () => 0 },
      asset: { findMany: async ({ where }) => (assetWheres.push(where), []) },
      folder: { findMany: async () => [] },
    };
    setPrismaClient(fake);
    await dashboardController.getDashboard({ userId: "member" }, responseRecorder());
    await workspacesController.getWorkspaceDashboard(
      { params: { workspaceId: "ws" }, userId: "member", membership: { role: "MEMBER", permissions: "" } },
      responseRecorder()
    );
    assert.equal(assetWheres.length, 2);
    assert.ok(assetWheres.every((where) => where.taskId === null));
    clearPrismaClient(fake);
  });

  it("excludes task attachments from global asset search", async () => {
    let assetWhere;
    const fake = {
      workspaceMember: {
        findMany: async () => [{ workspaceId: "ws", role: "MEMBER", permissions: "" }],
      },
      folder: { findMany: async () => [] },
      task: { findMany: async () => [] },
      message: { findMany: async () => [] },
      asset: { findMany: async ({ where }) => ((assetWhere = where), []) },
      user: { findMany: async () => [] },
    };
    setPrismaClient(fake);
    await searchController.globalSearch({ userId: "member", query: { q: "report" } }, responseRecorder());
    assert.equal(assetWhere.taskId, null);
    clearPrismaClient(fake);
  });

  it("removes FolderMember rows in the workspace when an admin removes a member", async () => {
    let folderDeleteWhere;
    const target = { id: "membership", userId: "removed", workspaceId: "ws", role: "MEMBER", workspace: { ownerId: "owner" } };
    const fake = {
      workspaceMember: {
        findUnique: async () => target,
        delete: async () => target,
      },
      folderMember: { deleteMany: async ({ where }) => ((folderDeleteWhere = where), { count: 1 }) },
      conversationParticipant: { deleteMany: async () => ({ count: 1 }) },
      $transaction: async (operations) => Promise.all(operations),
    };
    setPrismaClient(fake);
    await workspacesController.removeMember(
      { params: { workspaceId: "ws", memberId: "membership" }, userId: "owner", membership: { role: "ADMIN", permissions: "" } },
      responseRecorder()
    );
    assert.deepEqual(folderDeleteWhere, { userId: "removed", folder: { workspaceId: "ws" } });
    clearPrismaClient(fake);
  });
});

describe("strict object deletion", () => {
  it("requires complete storage configuration but permits an omitted native AWS endpoint", () => {
    configureFakeStorage();
    assert.equal(isStorageConfigured(), true);
    delete process.env.AWS_S3_BUCKET;
    assert.equal(isStorageConfigured(), false);
    configureFakeStorage();
  });

  it("rejects an unconfigured upload before invoking the multipart parser's next step", () => {
    configureFakeStorage();
    delete process.env.AWS_SECRET_ACCESS_KEY;
    let continued = false;
    assert.throws(
      () => requireStorageConfigured({}, {}, () => { continued = true; }),
      (err) => err.statusCode === 503
    );
    assert.equal(continued, false);
    configureFakeStorage();
  });

  it("treats NotFound as success and propagates other S3 failures", async () => {
    configureFakeStorage();
    setS3ClientForTests({ send: async () => { const err = new Error("missing"); err.name = "NotFound"; throw err; } });
    await deleteObject("ws", "missing");

    setS3ClientForTests({ send: async () => { throw new Error("network down"); } });
    await assert.rejects(deleteObject("ws", "object"), (err) => err.statusCode === 502);
  });

  it("preserves database metadata when storage is unconfigured", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    let deleted = false;
    const fake = {
      asset: {
        findUnique: async () => ({ id: "asset", workspaceId: "ws", taskId: null, folderId: null, uploadedById: "owner", versions: [{ storedName: "object" }] }),
        delete: async () => { deleted = true; },
      },
    };
    setPrismaClient(fake);
    await assert.rejects(
      assetsController.deleteAsset(
        { params: { workspaceId: "ws", assetId: "asset" }, userId: "owner", membership: { role: "MEMBER", permissions: "" } },
        responseRecorder()
      ),
      (err) => err.statusCode === 503
    );
    assert.equal(deleted, false);
    clearPrismaClient(fake);
    configureFakeStorage();
  });

  it("deletes an asset object before its database metadata", async () => {
    configureFakeStorage();
    const order = [];
    const fake = {
      asset: {
        findUnique: async () => ({ id: "asset", workspaceId: "ws", taskId: null, folderId: null, uploadedById: "owner", versions: [{ storedName: "object" }] }),
        delete: async () => { order.push("metadata"); },
      },
      realtimeEvent: { create: async () => ({}) },
    };
    setPrismaClient(fake);
    setS3ClientForTests({ send: async () => { order.push("object"); } });
    await assetsController.deleteAsset(
      { params: { workspaceId: "ws", assetId: "asset" }, userId: "owner", membership: { role: "MEMBER", permissions: "" } },
      responseRecorder()
    );
    assert.deepEqual(order, ["object", "metadata"]);
    clearPrismaClient(fake);
  });

  it("does not cascade task attachment metadata when object deletion fails", async () => {
    configureFakeStorage();
    let taskDeleted = false;
    const fake = {
      task: {
        findUnique: async () => ({
          id: "task",
          workspaceId: "ws",
          attachments: [{ versions: [{ storedName: "object" }] }],
        }),
        delete: async () => { taskDeleted = true; },
      },
    };
    setPrismaClient(fake);
    setS3ClientForTests({ send: async () => { throw new Error("network down"); } });
    await assert.rejects(
      tasksController.deleteTask({ params: { workspaceId: "ws", taskId: "task" } }, responseRecorder()),
      (err) => err.statusCode === 502
    );
    assert.equal(taskDeleted, false);
    clearPrismaClient(fake);
  });

  it("aborts channel metadata deletion when an attachment object delete fails", async () => {
    configureFakeStorage();
    let metadataDeleted = false;
    const fake = {
      message: { findMany: async () => [{ attachmentAssetId: "asset" }] },
      folder: {
        findUnique: async () => ({ assets: [] }),
      },
      asset: {
        findMany: async () => [{ id: "asset", versions: [{ storedName: "object" }] }],
        deleteMany: async () => { metadataDeleted = true; },
      },
      conversation: { delete: async () => { metadataDeleted = true; } },
      $transaction: async (operations) => Promise.all(operations),
    };
    setPrismaClient(fake);
    setS3ClientForTests({ send: async () => { throw new Error("network down"); } });
    await assert.rejects(
      purgeConversationAndAttachments({ id: "conversation", workspaceId: "ws" }),
      (err) => err.statusCode === 502
    );
    assert.equal(metadataDeleted, false);
    clearPrismaClient(fake);
  });

  it("deletes channel objects before attachment and conversation metadata", async () => {
    configureFakeStorage();
    const order = [];
    const fake = {
      message: { findMany: async () => [{ attachmentAssetId: "asset" }] },
      folder: {
        findUnique: async () => ({ assets: [] }),
      },
      asset: {
        findMany: async () => [{ id: "asset", versions: [{ storedName: "object" }] }],
        deleteMany: async () => { order.push("asset metadata"); },
      },
      conversation: { delete: async () => { order.push("conversation metadata"); } },
      $transaction: async (operations) => Promise.all(operations),
    };
    setPrismaClient(fake);
    setS3ClientForTests({ send: async () => { order.push("object"); } });
    await purgeConversationAndAttachments({ id: "conversation", workspaceId: "ws" });
    assert.deepEqual(order, ["object", "asset metadata", "conversation metadata"]);
    clearPrismaClient(fake);
  });

  it("purges moved references and abandoned uploads once without touching unrelated assets", async () => {
    configureFakeStorage();
    let selectedIds;
    let deletedIds;
    const objectKeys = [];
    const fake = {
      message: {
        findMany: async () => [
          { attachmentAssetId: "moved" },
          { attachmentAssetId: "moved" },
        ],
      },
      folder: { findUnique: async () => ({ assets: [{ id: "abandoned" }] }) },
      asset: {
        findMany: async ({ where }) => {
          selectedIds = where.id.in;
          return [
            { id: "moved", versions: [{ storedName: "shared" }, { storedName: "moved-only" }] },
            { id: "abandoned", versions: [{ storedName: "shared" }, { storedName: "abandoned-only" }] },
          ];
        },
        deleteMany: async ({ where }) => {
          deletedIds = where.id.in;
        },
      },
      conversation: { delete: async () => ({}) },
      $transaction: async (operations) => Promise.all(operations),
    };
    setPrismaClient(fake);
    setS3ClientForTests({ send: async (command) => objectKeys.push(command.input.Key) });
    await purgeConversationAndAttachments({ id: "conversation", workspaceId: "ws" });
    assert.deepEqual(new Set(selectedIds), new Set(["moved", "abandoned"]));
    assert.deepEqual(new Set(deletedIds), new Set(["moved", "abandoned"]));
    assert.deepEqual(objectKeys, ["ws/shared", "ws/moved-only", "ws/abandoned-only"]);
    assert.ok(!selectedIds.includes("unrelated"));
    clearPrismaClient(fake);
  });
});
