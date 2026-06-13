import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { User } from '../../auth/types';
import type { BlockedUserEntry, ContactEntry, SearchUser } from '../../users/types';
import type { ChannelDiscoveryItem, Conversation, GroupDiscoveryItem, Message } from '../types';
import { ConversationList } from './ConversationList';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    status: 'online',
    ...overrides,
  };
}

function makeSearchUser(overrides: Partial<SearchUser> = {}): SearchUser {
  return {
    id: 'user-2',
    username: 'bob',
    email: 'bob@example.com',
    status: 'offline',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    content: 'Latest update',
    type: 'text',
    senderId: 'user-1',
    conversationId: 'conversation-1',
    createdAt: '2026-06-13T08:00:00.000Z',
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    type: 'group',
    name: 'Project Team',
    memberCount: 3,
    lastMessage: makeMessage(),
    unreadCount: 0,
    lastActivityAt: '2026-06-13T08:00:00.000Z',
    ...overrides,
  };
}

function makeGroup(overrides: Partial<GroupDiscoveryItem> = {}): GroupDiscoveryItem {
  return {
    id: 'group-1',
    groupId: 'group-1',
    conversationId: 'conversation-group-1',
    name: 'Public Group',
    announcement: 'Open discussion',
    memberCount: 12,
    isJoined: false,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ChannelDiscoveryItem> = {}): ChannelDiscoveryItem {
  return {
    id: 'channel-1',
    channelId: 'channel-1',
    conversationId: 'conversation-channel-1',
    name: 'Announcements',
    description: 'Product updates',
    memberCount: 42,
    isSubscribed: false,
    ...overrides,
  };
}

function renderConversationList(overrides: Partial<ComponentProps<typeof ConversationList>> = {}) {
  const props: ComponentProps<typeof ConversationList> = {
    currentUser: makeUser(),
    notificationSlot: <span>Notifications</span>,
    conversations: [],
    activeConversationId: undefined,
    search: '',
    users: [],
    groupResults: [],
    channelResults: [],
    contacts: [],
    blockedUsers: [],
    loading: false,
    error: '',
    inviteInput: '',
    joiningInvite: false,
    discoveryActionLoading: '',
    onSearchChange: vi.fn(),
    onInviteInputChange: vi.fn(),
    onJoinInvite: vi.fn(),
    onSelectConversation: vi.fn(),
    onStartDirect: vi.fn(),
    onAddContact: vi.fn(),
    onRemoveContact: vi.fn(),
    onBlockUser: vi.fn(),
    onUnblockUser: vi.fn(),
    onJoinGroup: vi.fn(),
    onOpenJoinedGroup: vi.fn(),
    onSubscribeChannel: vi.fn(),
    onUnsubscribeChannel: vi.fn(),
    onOpenCreateGroup: vi.fn(),
    onOpenCreateChannel: vi.fn(),
    onOpenProfile: vi.fn(),
    onLogout: vi.fn(),
    onTogglePinned: vi.fn(),
    onToggleMuted: vi.fn(),
    onArchive: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<ConversationList {...props} />),
  };
}

describe('ConversationList', () => {
  afterEach(() => {
    cleanup();
  });

  it('emits topbar, search, create, and invite actions', () => {
    const emptyInvite = renderConversationList();
    expect(screen.getByLabelText('Join invite')).toHaveProperty('disabled', true);
    emptyInvite.unmount();

    const { props } = renderConversationList({ inviteInput: 'invite-code' });

    fireEvent.click(screen.getByTitle('Edit profile'));
    fireEvent.click(screen.getByLabelText('Logout'));
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'bob' } });
    fireEvent.click(screen.getByLabelText('New group'));
    fireEvent.click(screen.getByLabelText('New channel'));
    fireEvent.change(screen.getByPlaceholderText('Invite code or link'), { target: { value: 'new-code' } });
    fireEvent.submit(document.querySelector('.invite-join') as HTMLFormElement);

    expect(props.onOpenProfile).toHaveBeenCalledTimes(1);
    expect(props.onLogout).toHaveBeenCalledTimes(1);
    expect(props.onSearchChange).toHaveBeenCalledWith('bob');
    expect(props.onOpenCreateGroup).toHaveBeenCalledTimes(1);
    expect(props.onOpenCreateChannel).toHaveBeenCalledTimes(1);
    expect(props.onInviteInputChange).toHaveBeenCalledWith('new-code');
    expect(props.onJoinInvite).toHaveBeenCalledTimes(1);
  });

  it('renders people results and emits contact actions', () => {
    const bob = makeSearchUser();
    const carol = makeSearchUser({
      id: 'user-3',
      username: 'carol',
      email: 'carol@example.com',
      isContact: true,
    });
    const blocked = makeSearchUser({
      id: 'user-4',
      username: 'blocked',
      email: 'blocked@example.com',
      isBlocked: true,
    });
    const { props } = renderConversationList({ users: [bob, carol, blocked] });
    const bobRow = screen.getByText('bob@example.com').closest('.conversation-row') as HTMLElement;
    const carolRow = screen.getByText('Contact').closest('.conversation-row') as HTMLElement;
    const blockedRow = screen.getByText('Blocked').closest('.conversation-row') as HTMLElement;

    fireEvent.click(within(bobRow).getByTitle('Message'));
    fireEvent.click(within(bobRow).getByTitle('Add contact'));
    fireEvent.click(within(bobRow).getByTitle('Block'));
    fireEvent.click(within(carolRow).getByTitle('Remove contact'));
    fireEvent.click(within(blockedRow).getByTitle('Unblock'));

    expect(props.onStartDirect).toHaveBeenCalledWith(bob);
    expect(props.onAddContact).toHaveBeenCalledWith(bob);
    expect(props.onBlockUser).toHaveBeenCalledWith(bob);
    expect(props.onRemoveContact).toHaveBeenCalledWith(carol);
    expect(props.onUnblockUser).toHaveBeenCalledWith(blocked);
  });

  it('renders discovery results and emits group/channel actions', () => {
    const group = makeGroup();
    const joinedGroup = makeGroup({
      id: 'group-2',
      groupId: 'group-2',
      conversationId: 'conversation-group-2',
      name: 'Joined Group',
      isJoined: true,
    });
    const channel = makeChannel();
    const subscribedChannel = makeChannel({
      id: 'channel-2',
      channelId: 'channel-2',
      conversationId: 'conversation-channel-2',
      name: 'Subscribed Channel',
      isSubscribed: true,
    });
    const { props } = renderConversationList({
      groupResults: [group, joinedGroup],
      channelResults: [channel, subscribedChannel],
    });

    fireEvent.click(within(screen.getByText('Public Group').closest('.conversation-row') as HTMLElement).getByTitle('Join group'));
    fireEvent.click(within(screen.getByText('Joined Group').closest('.conversation-row') as HTMLElement).getByTitle('Open group'));
    fireEvent.click(within(screen.getByText('Announcements').closest('.conversation-row') as HTMLElement).getByTitle('Subscribe'));
    fireEvent.click(within(screen.getByText('Subscribed Channel').closest('.conversation-row') as HTMLElement).getByTitle('Leave channel'));

    expect(props.onJoinGroup).toHaveBeenCalledWith(group);
    expect(props.onOpenJoinedGroup).toHaveBeenCalledWith(joinedGroup);
    expect(props.onSubscribeChannel).toHaveBeenCalledWith(channel);
    expect(props.onUnsubscribeChannel).toHaveBeenCalledWith(subscribedChannel);
  });

  it('filters conversations and keeps row actions from selecting the chat', () => {
    const onSelectConversation = vi.fn();
    const project = makeConversation({
      name: 'Project Team',
      lastMessage: makeMessage({ content: 'Release today' }),
      unreadCount: 2,
    });
    const random = makeConversation({
      id: 'conversation-2',
      conversationId: 'conversation-2',
      name: 'Random',
      lastMessage: makeMessage({ content: 'Lunch' }),
    });
    const { props } = renderConversationList({
      conversations: [project, random],
      search: 'release',
      onSelectConversation,
    });
    const row = screen.getByText('Project Team').closest('.conversation-row') as HTMLElement;

    expect(screen.queryByText('Random')).toBeNull();

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });

    expect(props.onSelectConversation).toHaveBeenCalledTimes(2);
    expect(props.onSelectConversation).toHaveBeenCalledWith(project);

    onSelectConversation.mockClear();
    fireEvent.click(within(row).getByTitle('Pin'));
    fireEvent.click(within(row).getByTitle('Mute'));
    fireEvent.click(within(row).getByTitle('Archive'));

    expect(props.onTogglePinned).toHaveBeenCalledWith(project);
    expect(props.onToggleMuted).toHaveBeenCalledWith(project);
    expect(props.onArchive).toHaveBeenCalledWith(project);
    expect(onSelectConversation).not.toHaveBeenCalled();
  });

  it('renders contacts and blocked users when not searching', () => {
    const contact: ContactEntry = {
      user: makeSearchUser({ username: 'dana', email: 'dana@example.com' }),
      alias: 'Dana Work',
      createdAt: '2026-06-13T08:00:00.000Z',
    };
    const block: BlockedUserEntry = {
      user: makeSearchUser({ id: 'user-5', username: 'eric', email: 'eric@example.com' }),
      createdAt: '2026-06-13T08:00:00.000Z',
    };

    renderConversationList({ contacts: [contact], blockedUsers: [block] });

    expect(screen.getByText('Dana Work')).toBeTruthy();
    expect(screen.getByText('eric@example.com')).toBeTruthy();
  });
});
