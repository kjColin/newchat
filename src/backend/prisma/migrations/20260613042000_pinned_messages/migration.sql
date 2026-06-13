CREATE TABLE "PinnedMessage" (
  "conversationId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "pinnedById" TEXT NOT NULL,
  "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PinnedMessage_pkey" PRIMARY KEY ("conversationId", "messageId")
);

ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PinnedMessage" ADD CONSTRAINT "PinnedMessage_pinnedById_fkey"
  FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PinnedMessage_conversationId_pinnedAt_idx" ON "PinnedMessage"("conversationId", "pinnedAt");
CREATE INDEX "PinnedMessage_pinnedById_idx" ON "PinnedMessage"("pinnedById");
