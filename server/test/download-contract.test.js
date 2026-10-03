import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { api } from "../../client/src/api/client.js";
import {
  downloadVersion as downloadVersionInBrowser,
  fetchVersionBlob,
} from "../../client/src/api/assets.js";
import { clearPrismaClient, setPrismaClient } from "../src/db/prisma.js";
import { downloadVersion as issueDownloadUrl } from "../src/controllers/assets.controller.js";
import { resetStorageForTests, setDownloadSignerForTests } from "../src/utils/uploads.js";

const STORAGE_ENV = ["AWS_REGION", "AWS_S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3"];
const savedEnv = {};
const signedUrl = "https://loft-test-private.s3.ap-southeast-1.amazonaws.com/ws/object?signature=secret";

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
    json(body) {
      this.body = body;
      return this;
    },
    redirect() {
      assert.fail("download endpoint must not redirect");
    },
  };
}

function versionRecord(folderId = null) {
  return {
    id: "version",
    assetId: "asset",
    storedName: "server-generated-object",
    originalName: "Quarterly résumé.pdf",
    asset: { id: "asset", workspaceId: "ws", folderId },
  };
}

before(() => {
  for (const key of STORAGE_ENV) savedEnv[key] = process.env[key];
  configureFakeStorage();
});

after(() => {
  resetStorageForTests();
  for (const key of STORAGE_ENV) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("presigned download endpoint", () => {
  it("returns an authorized five-minute signed URL as JSON instead of redirecting", async () => {
    const fakePrisma = {
      assetVersion: { findUnique: async () => versionRecord() },
    };
    let signerInput;
    setPrismaClient(fakePrisma);
    setDownloadSignerForTests(async (_client, command, options) => {
      signerInput = { command: command.input, options };
      return signedUrl;
    });
    try {
      const response = responseRecorder();
      await issueDownloadUrl(
        {
          params: { workspaceId: "ws", assetId: "asset", versionId: "version" },
          userId: "member",
          membership: { role: "MEMBER", permissions: "" },
        },
        response
      );

      assert.deepEqual(response.body, { url: signedUrl });
      assert.equal(signerInput.options.expiresIn, 300);
      assert.equal(signerInput.command.Key, "ws/server-generated-object");
      assert.match(signerInput.command.ResponseContentDisposition, /^attachment;/);
      assert.match(signerInput.command.ResponseContentDisposition, /filename\*=UTF-8''Quarterly%20r%C3%A9sum%C3%A9\.pdf/);
    } finally {
      clearPrismaClient(fakePrisma);
      resetStorageForTests();
      configureFakeStorage();
    }
  });

  it("does not sign or return a URL when restricted-folder authorization fails", async () => {
    const restrictedFolder = {
      id: "restricted",
      workspaceId: "ws",
      parentId: null,
      visibility: "RESTRICTED",
      createdById: "owner",
      members: [],
    };
    const fakePrisma = {
      assetVersion: { findUnique: async () => versionRecord(restrictedFolder.id) },
      folder: { findMany: async () => [restrictedFolder] },
    };
    let signerCalled = false;
    setPrismaClient(fakePrisma);
    setDownloadSignerForTests(async () => {
      signerCalled = true;
      return signedUrl;
    });
    try {
      const response = responseRecorder();
      await assert.rejects(
        issueDownloadUrl(
          {
            params: { workspaceId: "ws", assetId: "asset", versionId: "version" },
            userId: "outsider",
            membership: { role: "MEMBER", permissions: "" },
          },
          response
        ),
        (error) => error.statusCode === 403
      );
      assert.equal(signerCalled, false);
      assert.equal(response.body, undefined);
    } finally {
      clearPrismaClient(fakePrisma);
      resetStorageForTests();
      configureFakeStorage();
    }
  });
});

describe("browser preview and download contract", () => {
  it("requests JSON authorization first, then fetches the signed URL without credentials", async () => {
    const originalGet = api.get;
    const originalFetch = globalThis.fetch;
    const requests = [];
    const expectedBlob = { kind: "preview-blob" };
    api.get = async (...args) => {
      requests.push(["api", ...args]);
      return { data: { url: signedUrl } };
    };
    globalThis.fetch = async (...args) => {
      requests.push(["s3", ...args]);
      return { ok: true, blob: async () => expectedBlob };
    };
    try {
      const blob = await fetchVersionBlob("ws", "asset", { id: "version" });
      assert.equal(blob, expectedBlob);
      assert.deepEqual(requests, [
        ["api", "/workspaces/ws/assets/asset/versions/version/download"],
        ["s3", signedUrl, { credentials: "omit" }],
      ]);
    } finally {
      api.get = originalGet;
      globalThis.fetch = originalFetch;
    }
  });

  it("downloads the direct S3 response with the original filename", async () => {
    const originalGet = api.get;
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const blob = { kind: "download-blob" };
    const anchor = {
      href: "",
      download: "",
      clicked: false,
      removed: false,
      click() { this.clicked = true; },
      remove() { this.removed = true; },
    };
    api.get = async () => ({ data: { url: signedUrl } });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, signedUrl);
      assert.deepEqual(options, { credentials: "omit" });
      return { ok: true, blob: async () => blob };
    };
    globalThis.document = {
      createElement: (tag) => {
        assert.equal(tag, "a");
        return anchor;
      },
      body: { appendChild: (node) => assert.equal(node, anchor) },
    };
    URL.createObjectURL = (value) => {
      assert.equal(value, blob);
      return "blob:download";
    };
    URL.revokeObjectURL = (value) => assert.equal(value, "blob:download");
    try {
      await downloadVersionInBrowser("ws", "asset", { id: "version", originalName: "résumé.pdf" });
      assert.equal(anchor.href, "blob:download");
      assert.equal(anchor.download, "résumé.pdf");
      assert.equal(anchor.clicked, true);
      assert.equal(anchor.removed, true);
    } finally {
      api.get = originalGet;
      globalThis.fetch = originalFetch;
      globalThis.document = originalDocument;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("does not contact S3 after an API authorization error and masks S3 failures", async () => {
    const originalGet = api.get;
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    const authorizationError = Object.assign(new Error("Forbidden"), { response: { status: 403 } });
    api.get = async () => { throw authorizationError; };
    globalThis.fetch = async () => {
      fetchCalled = true;
      return { ok: true, blob: async () => ({}) };
    };
    try {
      await assert.rejects(fetchVersionBlob("ws", "asset", { id: "version" }), (error) => error === authorizationError);
      assert.equal(fetchCalled, false);

      api.get = async () => ({ data: { url: signedUrl } });
      globalThis.fetch = async () => ({ ok: false, status: 403 });
      await assert.rejects(
        fetchVersionBlob("ws", "asset", { id: "version" }),
        (error) => error.message === "File could not be downloaded" && !error.message.includes(signedUrl)
      );
    } finally {
      api.get = originalGet;
      globalThis.fetch = originalFetch;
    }
  });
});
