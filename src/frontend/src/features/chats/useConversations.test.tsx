import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConversations, updateConversationSettings } from './api';
import type { Conversation, Message } from './types';
import { useConversations } from './useConversations';

vi.mock('./api', () => ({
  getConversations: vi.fn(),
  updateConversationSettings: vi.fn(),
}));

const mockGetConversations = vi.mocked(getConversations);
const mockUpdateConversationSettings = vi.mocked(updateConversationSettings);

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    type: 'direct',
    name: 'Alice',
    memberCount: 2,
    unreadCount: 0,
    lastActivityAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    content: 'Hello',
    type: 'text',
    senderId: 'user-2',
    conversationId: 'conversation-1',
    createdAt: '2026-06-13T00:10:00.000Z',
    ...overrides,
  };
}

async function renderLoadedConversations(conversations: Conversation[]) {
  mockGetConversations.mockResolvedValue(conversations);

  const hook = renderHook(() => useConversations());

  await waitFor(() => {
    expect(hook.result.current.loadingConversations).toBe(false);
  });

  return hook;
}

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversations.mockResolvedValue([]);
    mockUpdateConversationSettings.mockResolvedValue([]);
  });

  it('loads and sorts conversations with pinned chats first', async () => {
    const older = makeConversation({
      id: 'older',
      conversationId: 'older',
      lastActivityAt: '2026-06-12T00:00:00.000Z',
    });
    const newer = makeConversation({
      id: 'newer',
      conversationId: 'newer',
      lastActivityAt: '2026-06-13T02:00:00.000Z',
    });
    const pinned = makeConversation({
      id: 'pinned',
      conversationId: 'pinned',
      pinnedAt: '2026-06-13T01:00:00.000Z',
      lastActivityAt: '2026-06-11T00:00:00.000Z',
    });

    const { result } = await renderLoadedConversations([older, newer, pinned]);

    expect(result.current.sidebarError).toBe('');
    expect(result.current.conversations.map(conversation => conversation.id)).toEqual(['pinned', 'newer', 'older']);
    expect(result.current.conversationsRef.current).toEqual(result.current.conversations);
  });

  it('surfaces load failures and stops the loading state', async () => {
    mockGetConversations.mockRejectedValue({
      response: { data: { message: 'Could not reach chat service' } },
    });

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.loadingConversations).toBe(false);
    });

    expect(result.current.conversations).toEqual([]);
    expect(result.current.sidebarError).toBe('Could not reach chat service');
  });

  it('upserts, removes, and patches conversations locally', async () => {
    const initial = makeConversation({ id: 'conversation-1', name: 'Initial' });
    const { result } = await renderLoadedConversations([initial]);

    const inserted = makeConversation({
      id: 'conversation-2',
      conversationId: 'conversation-2',
      name: 'Inserted',
      lastActivityAt: '2026-06-13T03:00:00.000Z',
    });

    act(() => {
      result.current.upsertConversation(inserted);
      result.current.applyConversationPatch('conversation-1', { name: 'Renamed' });
    });

    expect(result.current.conversations.map(conversation => conversation.name)).toEqual(['Inserted', 'Renamed']);

    act(() => {
      result.current.removeConversation('conversation-2');
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]).toMatchObject({ id: 'conversation-1', name: 'Renamed' });
  });

  it('applies read state and incoming message activity', async () => {
    const conversation = makeConversation({
      id: 'conversation-1',
      unreadCount: 2,
      lastReadAt: '2026-06-12T00:00:00.000Z',
    });
    const { result } = await renderLoadedConversations([conversation]);

    act(() => {
      result.current.setActiveConversation(conversation);
      result.current.applyConversationRead('conversation-1', '2026-06-13T00:00:00.000Z');
    });

    expect(result.current.activeConversation).toMatchObject({
      unreadCount: 0,
      lastReadAt: '2026-06-13T00:00:00.000Z',
    });
    expect(result.current.conversations[0]).toMatchObject({
      unreadCount: 0,
      lastReadAt: '2026-06-13T00:00:00.000Z',
    });

    const incoming = makeMessage({
      id: 'message-incoming',
      senderId: 'user-2',
      createdAt: '2026-06-13T05:00:00.000Z',
    });

    act(() => {
      result.current.applyMessageActivity(incoming, {
        currentUserId: 'user-1',
        activeConversationId: null,
      });
    });

    expect(result.current.conversations[0]).toMatchObject({
      lastMessage: incoming,
      lastActivityAt: incoming.createdAt,
      unreadCount: 1,
    });

    const ownMessage = makeMessage({
      id: 'message-own',
      senderId: 'user-1',
      createdAt: '2026-06-13T06:00:00.000Z',
    });

    act(() => {
      result.current.applyMessageActivity(ownMessage, {
        currentUserId: 'user-1',
        activeConversationId: null,
      });
    });

    expect(result.current.conversations[0]).toMatchObject({
      lastMessage: ownMessage,
      unreadCount: 0,
    });
  });

  it('updates last messages after send, forward, and edit events', async () => {
    const first = makeConversation({
      id: 'conversation-1',
      unreadCount: 3,
      lastActivityAt: '2026-06-13T00:00:00.000Z',
    });
    const second = makeConversation({
      id: 'conversation-2',
      conversationId: 'conversation-2',
      name: 'Second',
      lastActivityAt: '2026-06-13T01:00:00.000Z',
    });
    const { result } = await renderLoadedConversations([first, second]);

    act(() => {
      result.current.setActiveConversation(first);
    });

    const sent = makeMessage({
      id: 'message-sent',
      conversationId: 'conversation-1',
      senderId: 'user-1',
      createdAt: '2026-06-13T07:00:00.000Z',
    });

    act(() => {
      result.current.applySentMessage(sent);
    });

    expect(result.current.activeConversation).toMatchObject({ lastMessage: sent, unreadCount: 0 });
    expect(result.current.conversations[0]).toMatchObject({ id: 'conversation-1', lastMessage: sent, unreadCount: 0 });

    const forwarded = makeMessage({
      id: 'message-forwarded',
      conversationId: 'conversation-2',
      createdAt: '2026-06-13T08:00:00.000Z',
    });

    act(() => {
      result.current.applyForwardedMessage(forwarded);
    });

    expect(result.current.conversations[0]).toMatchObject({ id: 'conversation-2', lastMessage: forwarded });

    const edited = { ...forwarded, content: 'Edited content' };

    act(() => {
      result.current.applyLastMessageUpdate(edited);
    });

    expect(result.current.conversations[0].lastMessage).toEqual(edited);
  });

  it('patches direct user, presence, active conversation, and member count state', async () => {
    const direct = makeConversation({
      id: 'conversation-1',
      user: {
        id: 'user-2',
        username: 'alice',
        email: 'alice@example.com',
        status: 'offline',
      },
      memberCount: 2,
    });
    const { result } = await renderLoadedConversations([direct]);

    act(() => {
      result.current.setActiveConversation(direct);
      result.current.applyPresenceUpdate({
        userId: 'user-2',
        status: 'online',
        lastSeen: '2026-06-13T09:00:00.000Z',
      });
      result.current.applyDirectUserUpdate('user-2', {
        username: 'alice-updated',
        avatar: 'https://example.com/avatar.png',
      });
      result.current.applyMemberCount('conversation-1', 5);
    });

    expect(result.current.conversations[0].user).toMatchObject({
      username: 'alice-updated',
      status: 'online',
      avatar: 'https://example.com/avatar.png',
    });
    expect(result.current.conversations[0].memberCount).toBe(5);
    expect(result.current.activeConversation).toMatchObject({
      memberCount: 5,
      user: {
        username: 'alice-updated',
        avatar: 'https://example.com/avatar.png',
      },
    });
  });

  it('updates settings through the API and returns sorted results', async () => {
    const conversation = makeConversation({ id: 'conversation-1', pinnedAt: null });
    const updated = [
      makeConversation({
        id: 'conversation-2',
        conversationId: 'conversation-2',
        lastActivityAt: '2026-06-13T02:00:00.000Z',
      }),
      makeConversation({
        id: 'conversation-1',
        pinnedAt: '2026-06-13T09:00:00.000Z',
      }),
    ];
    mockUpdateConversationSettings.mockResolvedValue(updated);
    const { result } = await renderLoadedConversations([conversation]);

    let returned: Conversation[] | null = null;
    await act(async () => {
      returned = await result.current.updateConversationSetting(conversation, 'pinned');
    });

    expect(mockUpdateConversationSettings).toHaveBeenCalledWith('conversation-1', { pinned: true });
    expect(returned?.map(item => item.id)).toEqual(['conversation-1', 'conversation-2']);
    expect(result.current.conversations.map(item => item.id)).toEqual(['conversation-1', 'conversation-2']);
  });

  it('surfaces setting update errors', async () => {
    const conversation = makeConversation();
    mockUpdateConversationSettings.mockRejectedValue({
      response: { data: { message: 'Settings write failed' } },
    });
    const { result } = await renderLoadedConversations([conversation]);

    let returned: Conversation[] | null = [];
    await act(async () => {
      returned = await result.current.updateConversationSetting(conversation, 'muted');
    });

    expect(returned).toBeNull();
    expect(result.current.sidebarError).toBe('Settings write failed');
  });
});
