import type { Conversation } from './types';

export function upsertConversation(list: Conversation[], conversation: Conversation) {
  const exists = list.some(item => item.id === conversation.id);
  if (exists) return list.map(item => item.id === conversation.id ? conversation : item);
  return [conversation, ...list];
}

export function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => {
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    return new Date(b.lastActivityAt || b.lastMessage?.createdAt || 0).getTime() -
      new Date(a.lastActivityAt || a.lastMessage?.createdAt || 0).getTime();
  });
}
