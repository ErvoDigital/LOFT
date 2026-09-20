import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../prisma/seed.js";

describe("Database & Seed Safety Guard Unit Tests (In-Memory)", () => {
  it("1. seed() rejects immediately when NODE_ENV=production", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origOptIn = process.env.ALLOW_DEV_SEED;
    try {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_DEV_SEED = "true";

      await assert.rejects(
        async () => {
          await seed();
        },
        (err) => {
          assert.match(err.message, /Refusing to run development seed in production environment/i);
          return true;
        }
      );
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.ALLOW_DEV_SEED = origOptIn;
    }
  });

  it("2. seed() rejects immediately when ALLOW_DEV_SEED is missing or not 'true'", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origOptIn = process.env.ALLOW_DEV_SEED;
    try {
      process.env.NODE_ENV = "development";
      delete process.env.ALLOW_DEV_SEED;

      await assert.rejects(
        async () => {
          await seed();
        },
        (err) => {
          assert.match(err.message, /ALLOW_DEV_SEED=true is required to execute the development seed script/i);
          return true;
        }
      );

      process.env.ALLOW_DEV_SEED = "false";
      await assert.rejects(
        async () => {
          await seed();
        },
        (err) => {
          assert.match(err.message, /ALLOW_DEV_SEED=true is required to execute the development seed script/i);
          return true;
        }
      );
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.ALLOW_DEV_SEED = origOptIn;
    }
  });

  it("3. Integration test safety guard fails closed when TEST_DATABASE_URL is missing", () => {
    function validateTestDatabaseConfig(env) {
      const testDbUrl = env.TEST_DATABASE_URL?.trim();
      if (!testDbUrl) {
        throw new Error(
          "TEST_DATABASE_URL is not configured. Automated integration tests fail closed to protect development and production databases. Set TEST_DATABASE_URL to an isolated test database or Neon test branch."
        );
      }
      const defaultDbUrl = env.DATABASE_URL?.trim();
      if (defaultDbUrl && testDbUrl === defaultDbUrl) {
        throw new Error(
          "TEST_DATABASE_URL must not equal DATABASE_URL. Integration tests require an isolated test database to prevent accidental test data pollution on primary databases."
        );
      }
      return true;
    }

    assert.throws(
      () => validateTestDatabaseConfig({}),
      /TEST_DATABASE_URL is not configured/i
    );

    assert.throws(
      () => validateTestDatabaseConfig({ TEST_DATABASE_URL: "   " }),
      /TEST_DATABASE_URL is not configured/i
    );
  });

  it("4. Integration test safety guard rejects when TEST_DATABASE_URL equals DATABASE_URL", () => {
    function validateTestDatabaseConfig(env) {
      const testDbUrl = env.TEST_DATABASE_URL?.trim();
      if (!testDbUrl) {
        throw new Error(
          "TEST_DATABASE_URL is not configured. Automated integration tests fail closed to protect development and production databases. Set TEST_DATABASE_URL to an isolated test database or Neon test branch."
        );
      }
      const defaultDbUrl = env.DATABASE_URL?.trim();
      if (defaultDbUrl && testDbUrl === defaultDbUrl) {
        throw new Error(
          "TEST_DATABASE_URL must not equal DATABASE_URL. Integration tests require an isolated test database to prevent accidental test data pollution on primary databases."
        );
      }
      return true;
    }

    const sameUrl = "postgresql://user:pass@ep-fake.neon.tech/neondb";
    assert.throws(
      () => validateTestDatabaseConfig({ DATABASE_URL: sameUrl, TEST_DATABASE_URL: sameUrl }),
      /TEST_DATABASE_URL must not equal DATABASE_URL/i
    );

    // Passes when different
    const diffUrl = "postgresql://user:pass@ep-isolated-test.neon.tech/neondb";
    assert.equal(
      validateTestDatabaseConfig({ DATABASE_URL: sameUrl, TEST_DATABASE_URL: diffUrl }),
      true
    );
  });
});
