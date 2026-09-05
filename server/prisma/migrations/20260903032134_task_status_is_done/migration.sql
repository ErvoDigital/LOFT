-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8a8578',
    "order" REAL NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaskStatus" ("color", "createdAt", "id", "label", "order", "updatedAt", "workspaceId") SELECT "color", "createdAt", "id", "label", "order", "updatedAt", "workspaceId" FROM "TaskStatus";
DROP TABLE "TaskStatus";
ALTER TABLE "new_TaskStatus" RENAME TO "TaskStatus";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
