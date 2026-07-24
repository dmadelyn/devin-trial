/*
  Warnings:

  - Added the required column `rowHash` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seq` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevHash" TEXT,
    "rowHash" TEXT NOT NULL,
    CONSTRAINT "AuditLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "actor", "applicationId", "createdAt", "fromStatus", "id", "reason", "toStatus") SELECT "action", "actor", "applicationId", "createdAt", "fromStatus", "id", "reason", "toStatus" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_seq_idx" ON "AuditLog"("seq");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
