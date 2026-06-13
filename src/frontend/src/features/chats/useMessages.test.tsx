import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteMessage,
  editMessage,
  forwardMessage,
  getMessages,
  markConversationRead,
  searchMessages,
  sendMessage,
  toggleReaction,
  uploadFile,
} from './api';
import type { Attachment, Conversation, Message } from './types';
import { useMessages } from './useMessages';

vi.mock('./api', () => ({
  deleteMessage: vi.fn(),
  editMessage: vi.fn(),
  forwardMessage: vi.fn(),
  getMessages: vi.fn(),
  markConversationRead: vi.fn(),
  searchMessages: vi.fn(),
  sendMessage: vi.fn(),
  toggleReaction: vi.fn(),
  uploadFile: vi.fn(),
}));

const mockDeleteMessage = vi.mocked(deleteMessage);
const mockEditMessage = vi.mocked(editMessage);
const mockForwardMessage = vi.mocked(forwardMessage);
const mockGetMessages = vi.mocked(getMessages);
const mockMarkConversationRead = vi.mocked(markConversationRead);
const mockSearchMessages = vi.mocked(searchMessages);
const mockSendMessage = vi.mocked(sendMessage);
const mockToggleReaction = vi.mocked(toggleReaction);
const mockUploadFile = vi.mocked(uploadFile);

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    type: 'direct',
    name: 'Alice',
    memberCount: 2,
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
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    uploaderId: 'user-1',
    kind: 'file',
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    size: 128,
    url: 'https://example.com/report.pdf',
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeHandlers() {
  return {
    onConversationRead: vi.fn(),
    onMessageDeleted: vi.fn(),
    onMessageEdited: vi.fn(),
    onMessageForwarded: vi.fn(),
    onMessageSent: vi.fn(),
  };
}

function renderUseMessages(options: Partial<Parameters<typeof useMessages>[0]> = {}) {
  const handlers = makeHandlers();
  const messageListRef = {
    current: document.createElement('div'),
  };

  Object.defineProperty(messageListRef.current, 'scrollHeight', {
    configurable: true,
    value: 200,
  });
  messageListRef.current.scrollTop = 30;

  const hook = renderHook(() =>
    useMessages({
      messageListRef,
      ...handlers,
      ...options,
    }),
  );

  return {
    handlers,
    messageListRef,
    ...hook,
  };
}

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMessages.mockResolvedValue({ messages: [], hasMore: false });
    mockMarkConversationRead.mockResolvedValue({
      conversationId: 'conversation-1',
      userId: 'user-1',
      lastReadAt: '2026-06-13T00:01:00.000Z',
    });
  });

  it('loads conversation messages, sets unread marker, and marks the conversation read', async () => {
    const firstRead = makeMessage({
      id: 'message-read',
      senderId: 'user-2',
      createdAt: '2026-06-13T00:00:00.000Z',
    });
    const firstUnread = makeMessage({
      id: 'message-unread',
      senderId: 'user-2',
      createdAt: '2026-06-13T00:02:00.000Z',
    });
    const ownUnread = makeMessage({
      id: 'message-own',
      senderId: 'user-1',
      createdAt: '2026-06-13T00:03:00.000Z',
    });
    mockGetMessages.mockResolvedValue({ messages: [firstRead, firstUnread, ownUnread], hasMore: true });

    const { result, handlers } = renderUseMessages();

    await act(async () => {
      await result.current.loadConversationMessages({
        conversation: makeConversation({ lastReadAt: '2026-06-13T00:01:00.000Z' }),
        currentUserId: 'user-1',
      });
    });

    expect(mockGetMessages).toHaveBeenCalledWith('conversation-1');
    expect(result.current.messages).toEqual([firstRead, firstUnread, ownUnread]);
    expect(result.current.hasMoreMessages).toBe(true);
    expect(result.current.unreadMarkerId).toBe(firstUnread.id);
    expect(result.current.showJumpLatest).toBe(true);
    expect(handlers.onConversationRead).toHaveBeenCalledWith('conversation-1', '2026-06-13T00:01:00.000Z');
  });

  it('surfaces load failures and resets message state', async () => {
    mockGetMessages.mockRejectedValue({
      response: { data: { message: 'Message service unavailable' } },
    });

    const { result } = renderUseMessages();

    await act(async () => {
      await result.current.loadConversationMessages({
        conversation: makeConversation(),
        currentUserId: 'user-1',
      });
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.hasMoreMessages).toBe(false);
    expect(result.current.unreadMarkerId).toBeNull();
    expect(result.current.messageError).toBe('Message service unavailable');
  });

  it('sends text and attachment messages with reply metadata', async () => {
    const replyTo = makeMessage({ id: 'reply-to' });
    const imageAttachment = makeAttachment({ id: 'image-1', kind: 'image' });
    const sent = makeMessage({
      id: 'message-sent',
      senderId: 'user-1',
      content: 'Photo',
      type: 'image',
    });
    mockSendMessage.mockResolvedValue(sent);

    const { result, handlers } = renderUseMessages();

    let response: Awaited<ReturnType<typeof result.current.sendCurrentMessage>> | null = null;
    await act(async () => {
      response = await result.current.sendCurrentMessage({
        conversation: makeConversation(),
        content: '  Photo  ',
        editingMessage: null,
        replyToMessage: replyTo,
        pendingAttachments: [imageAttachment],
      });
    });

    expect(mockSendMessage).toHaveBeenCalledWith('conversation-1', 'Photo', {
      clientId: expect.any(String),
      replyToId: 'reply-to',
      attachmentIds: ['image-1'],
      type: 'image',
    });
    expect(response).toEqual({ message: sent, mode: 'send' });
    expect(result.current.messages).toEqual([sent]);
    expect(handlers.onMessageSent).toHaveBeenCalledWith(sent);
  });

  it('edits and deletes messages through API responses', async () => {
    const original = makeMessage({ id: 'message-1', content: 'Original' });
    const edited = makeMessage({ id: 'message-1', content: 'Edited' });
    const deleted = makeMessage({ id: 'message-1', content: '', deletedAt: '2026-06-13T00:04:00.000Z' });
    mockGetMessages.mockResolvedValue({ messages: [original], hasMore: false });
    mockEditMessage.mockResolvedValue(edited);
    mockDeleteMessage.mockResolvedValue(deleted);

    const { result, handlers } = renderUseMessages();

    await act(async () => {
      await result.current.loadConversationMessages({
        conversation: makeConversation(),
        currentUserId: 'user-1',
      });
    });

    await act(async () => {
      await result.current.sendCurrentMessage({
        conversation: makeConversation(),
        content: ' Edited ',
        editingMessage: original,
        replyToMessage: null,
        pendingAttachments: [],
      });
    });

    expect(mockEditMessage).toHaveBeenCalledWith('message-1', 'Edited');
    expect(result.current.messages[0]).toEqual(edited);
    expect(handlers.onMessageEdited).toHaveBeenCalledWith(edited);

    let deletedResult: Message | null = null;
    await act(async () => {
      deletedResult = await result.current.deleteCurrentMessage(edited);
    });

    expect(deletedResult).toEqual(deleted);
    expect(result.current.messages[0]).toEqual(deleted);
    expect(handlers.onMessageDeleted).toHaveBeenCalledWith(deleted);
  });

  it('forwards messages and updates reaction state', async () => {
    const original = makeMessage({ id: 'message-original' });
    const forwarded = makeMessage({ id: 'message-forwarded', content: 'Forwarded' });
    const reacted = makeMessage({
      id: 'message-forwarded',
      reactions: [{ id: 'reaction-1', emoji: '+1', userId: 'user-1', messageId: 'message-forwarded', createdAt: '2026-06-13T00:05:00.000Z' }],
    });
    mockForwardMessage.mockResolvedValue(forwarded);
    mockToggleReaction.mockResolvedValue(reacted);

    const { result, handlers } = renderUseMessages();

    await act(async () => {
      await result.current.forwardCurrentMessage(original, makeConversation());
    });

    expect(mockForwardMessage).toHaveBeenCalledWith('message-original', 'conversation-1', expect.any(String));
    expect(result.current.messages).toEqual([forwarded]);
    expect(handlers.onMessageForwarded).toHaveBeenCalledWith(forwarded);

    await act(async () => {
      await result.current.reactToMessage(forwarded, '+1');
    });

    expect(mockToggleReaction).toHaveBeenCalledWith('message-forwarded', '+1');
    expect(result.current.messages[0]).toEqual(reacted);
  });

  it('searches messages, clears short queries, and surfaces search errors', async () => {
    const match = makeMessage({ id: 'message-match', content: 'matching text' });
    mockSearchMessages.mockResolvedValue({ messages: [match] });

    const { result } = renderUseMessages();

    await act(async () => {
      await result.current.searchConversationMessages(makeConversation(), ' match ');
    });

    expect(mockSearchMessages).toHaveBeenCalledWith('conversation-1', 'match');
    expect(result.current.messageSearch).toBe(' match ');
    expect(result.current.messageSearchResults).toEqual([match]);
    expect(result.current.searchingMessages).toBe(false);

    await act(async () => {
      await result.current.searchConversationMessages(makeConversation(), 'm');
    });

    expect(result.current.messageSearchResults).toEqual([]);

    mockSearchMessages.mockRejectedValue({
      response: { data: { message: 'Search failed' } },
    });

    await act(async () => {
      await result.current.searchConversationMessages(makeConversation(), 'error');
    });

    expect(result.current.messageError).toBe('Search failed');
    expect(result.current.messageSearchResults).toEqual([]);
  });

  it('uploads up to ten files and reports upload errors', async () => {
    const uploaded = makeAttachment({ id: 'uploaded-1' });
    mockUploadFile.mockResolvedValue(uploaded);
    const files = Array.from({ length: 12 }, (_, index) =>
      new File([`file-${index}`], `file-${index}.txt`, { type: 'text/plain' }),
    );

    const { result } = renderUseMessages();

    let attachments: Attachment[] = [];
    await act(async () => {
      attachments = await result.current.uploadAttachments(files as unknown as FileList);
    });

    expect(mockUploadFile).toHaveBeenCalledTimes(10);
    expect(attachments).toHaveLength(10);
    expect(result.current.sending).toBe(false);

    mockUploadFile.mockRejectedValue({
      response: { data: { message: 'Upload rejected' } },
    });

    await act(async () => {
      attachments = await result.current.uploadAttachments(files.slice(0, 1) as unknown as FileList);
    });

    expect(attachments).toEqual([]);
    expect(result.current.messageError).toBe('Upload rejected');
  });

  it('loads earlier messages with cursor pagination and deduplicates existing messages', async () => {
    const existing = makeMessage({
      id: 'message-existing',
      createdAt: '2026-06-13T00:10:00.000Z',
    });
    const older = makeMessage({
      id: 'message-older',
      createdAt: '2026-06-13T00:01:00.000Z',
    });
    mockGetMessages
      .mockResolvedValueOnce({ messages: [existing], hasMore: true })
      .mockResolvedValueOnce({ messages: [older, existing], hasMore: false });

    const { result, messageListRef } = renderUseMessages();

    await act(async () => {
      await result.current.loadConversationMessages({
        conversation: makeConversation(),
        currentUserId: 'user-1',
      });
    });

    Object.defineProperty(messageListRef.current, 'scrollHeight', {
      configurable: true,
      value: 320,
    });

    await act(async () => {
      await result.current.loadEarlierMessages(makeConversation());
    });

    expect(mockGetMessages).toHaveBeenLastCalledWith('conversation-1', {
      beforeCreatedAt: existing.createdAt,
      beforeId: existing.id,
    });
    expect(result.current.messages).toEqual([older, existing]);
    expect(result.current.hasMoreMessages).toBe(false);
  });

  it('applies socket and profile updates without duplicating messages', () => {
    const existing = makeMessage({
      id: 'message-2',
      createdAt: '2026-06-13T00:02:00.000Z',
      senderId: 'user-2',
    });
    const earlier = makeMessage({
      id: 'message-1',
      createdAt: '2026-06-13T00:01:00.000Z',
      senderId: 'user-2',
    });
    const updated = { ...existing, content: 'Updated' };

    const { result } = renderUseMessages();

    act(() => {
      result.current.applyIncomingMessage(existing);
      result.current.applyIncomingMessage(existing);
      result.current.ensureMessageVisible(earlier);
      result.current.applyUpdatedMessage(updated);
      result.current.applyProfileUpdate({
        id: 'user-2',
        username: 'alice-updated',
        avatar: 'https://example.com/avatar.png',
      });
    });

    expect(result.current.messages.map(message => message.id)).toEqual(['message-1', 'message-2']);
    expect(result.current.messages[1]).toMatchObject({
      content: 'Updated',
      sender: {
        id: 'user-2',
        username: 'alice-updated',
        avatar: 'https://example.com/avatar.png',
      },
    });

    act(() => {
      result.current.setUnreadMarkerId('message-1');
      result.current.setShowJumpLatest(true);
      result.current.clearMessageSearch();
      result.current.resetMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.unreadMarkerId).toBeNull();
    expect(result.current.showJumpLatest).toBe(false);
  });
});
