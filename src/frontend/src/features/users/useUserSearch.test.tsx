import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discoverChannels, discoverGroups } from '../chats/api';
import type { ChannelDiscoveryItem, GroupDiscoveryItem } from '../chats/types';
import { searchUsers } from './api';
import type { SearchUser } from './types';
import { useUserSearch } from './useUserSearch';

vi.mock('../chats/api', () => ({
  discoverChannels: vi.fn(),
  discoverGroups: vi.fn(),
}));

vi.mock('./api', () => ({
  searchUsers: vi.fn(),
}));

const mockDiscoverChannels = vi.mocked(discoverChannels);
const mockDiscoverGroups = vi.mocked(discoverGroups);
const mockSearchUsers = vi.mocked(searchUsers);

function makeUser(overrides: Partial<SearchUser> = {}): SearchUser {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    status: 'offline',
    ...overrides,
  };
}

function makeGroup(overrides: Partial<GroupDiscoveryItem> = {}): GroupDiscoveryItem {
  return {
    id: 'group-1',
    groupId: 'group-1',
    conversationId: 'conversation-group-1',
    name: 'Design',
    memberCount: 4,
    isJoined: false,
    role: null,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ChannelDiscoveryItem> = {}): ChannelDiscoveryItem {
  return {
    id: 'channel-1',
    channelId: 'channel-1',
    conversationId: 'conversation-channel-1',
    name: 'Announcements',
    memberCount: 12,
    isSubscribed: false,
    role: null,
    ...overrides,
  };
}

async function advanceSearchDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSearchUsers.mockResolvedValue([]);
    mockDiscoverGroups.mockResolvedValue([]);
    mockDiscoverChannels.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('debounces sidebar search and loads users, groups, and channels', async () => {
    const user = makeUser();
    const group = makeGroup();
    const channel = makeChannel();
    mockSearchUsers.mockResolvedValue([user]);
    mockDiscoverGroups.mockResolvedValue([group]);
    mockDiscoverChannels.mockResolvedValue([channel]);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.setSearch('  design  ');
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();

    await advanceSearchDebounce();

    expect(result.current.searchResults).toEqual([user]);
    expect(result.current.groupResults).toEqual([group]);
    expect(result.current.channelResults).toEqual([channel]);
    expect(mockSearchUsers).toHaveBeenCalledWith('design');
    expect(mockDiscoverGroups).toHaveBeenCalledWith('design');
    expect(mockDiscoverChannels).toHaveBeenCalledWith('design');
  });

  it('clears sidebar search results without calling discovery APIs for a blank query', async () => {
    const user = makeUser();
    const group = makeGroup();
    const channel = makeChannel();
    mockSearchUsers.mockResolvedValue([user]);
    mockDiscoverGroups.mockResolvedValue([group]);
    mockDiscoverChannels.mockResolvedValue([channel]);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.setSearch('team');
    });
    await advanceSearchDebounce();
    expect(result.current.searchResults).toEqual([user]);

    vi.clearAllMocks();

    act(() => {
      result.current.setSearch('   ');
    });
    await advanceSearchDebounce();

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.groupResults).toEqual([]);
    expect(result.current.channelResults).toEqual([]);
    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(mockDiscoverGroups).not.toHaveBeenCalled();
    expect(mockDiscoverChannels).not.toHaveBeenCalled();
  });

  it('searches create-group and add-member user pickers independently', async () => {
    const groupUser = makeUser({ id: 'user-group', username: 'group-user' });
    const memberUser = makeUser({ id: 'user-member', username: 'member-user' });
    mockSearchUsers
      .mockResolvedValueOnce([groupUser])
      .mockResolvedValueOnce([memberUser]);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.setGroupSearch('group');
      result.current.setMemberSearch('member');
    });
    await advanceSearchDebounce();

    expect(result.current.groupSearchResults).toEqual([groupUser]);
    expect(result.current.memberSearchResults).toEqual([memberUser]);
    expect(mockSearchUsers).toHaveBeenCalledWith('group');
    expect(mockSearchUsers).toHaveBeenCalledWith('member');
  });

  it('patches search users across all user result lists', async () => {
    const user = makeUser();
    mockSearchUsers.mockResolvedValue([user]);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.setSearch('alice');
      result.current.setGroupSearch('alice');
      result.current.setMemberSearch('alice');
    });
    await advanceSearchDebounce();
    expect(result.current.memberSearchResults).toEqual([user]);

    act(() => {
      result.current.patchSearchUser('user-1', {
        isContact: true,
        username: 'alice-updated',
      });
    });

    expect(result.current.searchResults[0]).toMatchObject({ isContact: true, username: 'alice-updated' });
    expect(result.current.groupSearchResults[0]).toMatchObject({ isContact: true, username: 'alice-updated' });
    expect(result.current.memberSearchResults[0]).toMatchObject({ isContact: true, username: 'alice-updated' });
  });

  it('updates discovery items after join and subscription actions', async () => {
    const group = makeGroup();
    const channel = makeChannel();
    mockDiscoverGroups.mockResolvedValue([group]);
    mockDiscoverChannels.mockResolvedValue([channel]);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.setSearch('announcements');
    });
    await advanceSearchDebounce();
    expect(result.current.groupResults).toEqual([group]);
    expect(result.current.channelResults).toEqual([channel]);

    act(() => {
      result.current.markGroupJoined(group, 'member', 5);
      result.current.markChannelSubscribed(channel, 'subscriber', 13);
    });

    expect(result.current.groupResults[0]).toMatchObject({ isJoined: true, role: 'member', memberCount: 5 });
    expect(result.current.channelResults[0]).toMatchObject({ isSubscribed: true, role: 'subscriber', memberCount: 13 });

    act(() => {
      result.current.markChannelUnsubscribed(result.current.channelResults[0]);
    });

    expect(result.current.channelResults[0]).toMatchObject({
      isSubscribed: false,
      role: null,
      memberCount: 12,
    });
  });
});
