ALTER TABLE "Message" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN "forwardFromId" TEXT;

ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardFromId_fkey"
  FOREIGN KEY ("forwardFromId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Message_senderId_clientId_key" ON "Message"("senderId", "clientId");
CREATE INDEX "Message_conversationId_deletedAt_createdAt_idx" ON "Message"("conversationId", "deletedAt", "createdAt");
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
CREATE INDEX "Message_forwardFromId_idx" ON "Message"("forwardFromId");
