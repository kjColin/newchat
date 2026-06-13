import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateConversation } from './useCreateConversation';
import { createChannel, createGroup } from './api';
import type { Conversation } from './types';
import type { SearchUser } from '../users/types';

vi.mock('./api', () => ({
  createChannel: vi.fn(),
  createGroup: vi.fn(),
}));

const mockCreateChannel = vi.mocked(createChannel);
const mockCreateGroup = vi.mocked(createGroup);

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    type: 'group',
    name: 'Team',
    memberCount: 2,
    ...overrides,
  };
}

function makeUser(overrides: Partial<SearchUser> = {}): SearchUser {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    ...overrides,
  };
}

describe('useCreateConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a group, resets the form, and selects the new conversation', async () => {
    const conversation = makeConversation();
    const onConversationCreated = vi.fn().mockResolvedValue(undefined);
    const onClearGroupSearch = vi.fn();
    mockCreateGroup.mockResolvedValue(conversation);

    const { result } = renderHook(() =>
      useCreateConversation({
        onConversationCreated,
        onClearGroupSearch,
      }),
    );

    const firstUser = makeUser();
    const secondUser = makeUser({
      id: 'user-2',
      username: 'bob',
      email: 'bob@example.com',
    });

    act(() => {
      result.current.openCreateGroup();
      result.current.setGroupName('  Project Team  ');
      result.current.toggleMember(firstUser);
      result.current.toggleMember(secondUser);
    });

    await act(async () => {
      await result.current.submitGroup();
    });

    expect(mockCreateGroup).toHaveBeenCalledWith('Project Team', ['user-1', 'user-2']);
    expect(onClearGroupSearch).toHaveBeenCalledTimes(1);
    expect(onConversationCreated).toHaveBeenCalledWith(conversation);
    expect(result.current.createGroupOpen).toBe(false);
    expect(result.current.groupName).toBe('');
    expect(result.current.selectedMembers).toEqual([]);
    expect(result.current.createError).toBe('');
    expect(result.current.creatingGroup).toBe(false);
  });

  it('creates a channel, resets the form, and selects the new conversation', async () => {
    const conversation = makeConversation({
      id: 'conversation-2',
      conversationId: 'conversation-2',
      type: 'channel',
      name: 'Announcements',
    });
    const onConversationCreated = vi.fn().mockResolvedValue(undefined);
    mockCreateChannel.mockResolvedValue(conversation);

    const { result } = renderHook(() =>
      useCreateConversation({
        onConversationCreated,
        onClearGroupSearch: vi.fn(),
      }),
    );

    act(() => {
      result.current.openCreateChannel();
      result.current.setChannelName('  Announcements  ');
      result.current.setChannelDescription('  Product updates  ');
    });

    await act(async () => {
      await result.current.submitChannel();
    });

    expect(mockCreateChannel).toHaveBeenCalledWith('Announcements', 'Product updates');
    expect(onConversationCreated).toHaveBeenCalledWith(conversation);
    expect(result.current.createChannelOpen).toBe(false);
    expect(result.current.channelName).toBe('');
    expect(result.current.channelDescription).toBe('');
    expect(result.current.channelError).toBe('');
    expect(result.current.creatingChannel).toBe(false);
  });

  it('keeps the group form open and surfaces API errors', async () => {
    const onConversationCreated = vi.fn();
    const onClearGroupSearch = vi.fn();
    mockCreateGroup.mockRejectedValue({
      response: { data: { message: 'Group name is required' } },
    });

    const { result } = renderHook(() =>
      useCreateConversation({
        onConversationCreated,
        onClearGroupSearch,
      }),
    );

    act(() => {
      result.current.openCreateGroup();
    });

    await act(async () => {
      await result.current.submitGroup();
    });

    await waitFor(() => {
      expect(result.current.createError).toBe('Group name is required');
    });
    expect(result.current.createGroupOpen).toBe(true);
    expect(result.current.creatingGroup).toBe(false);
    expect(onClearGroupSearch).not.toHaveBeenCalled();
    expect(onConversationCreated).not.toHaveBeenCalled();
  });
});
