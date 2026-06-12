CREATE TABLE "InviteLink" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InviteLink_code_key" ON "InviteLink"("code");
CREATE INDEX "InviteLink_groupId_revokedAt_idx" ON "InviteLink"("groupId", "revokedAt");
CREATE INDEX "InviteLink_createdById_idx" ON "InviteLink"("createdById");
