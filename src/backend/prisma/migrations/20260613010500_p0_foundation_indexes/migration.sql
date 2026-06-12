CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
CREATE INDEX "GroupMember_groupId_role_idx" ON "GroupMember"("groupId", "role");
CREATE INDEX "UserConversation_userId_archivedAt_pinnedAt_idx" ON "UserConversation"("userId", "archivedAt", "pinnedAt");
