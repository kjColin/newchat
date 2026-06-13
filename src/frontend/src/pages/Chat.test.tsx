import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../features/auth/types';
import type { Conversation, Message } from '../features/chats/types';
import type { SearchUser } from '../features/users/types';
import { ChatPage } from './Chat';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useUserSearch: vi.fn(),
  useConversations: vi.fn(),
  useConversationDetails: vi.fn(),
  useCreateConversation: vi.fn(),
  useMessages: vi.fn(),
  useNotifications: vi.fn(),
  useChatSocket: vi.fn(),
  getPinnedMessages: vi.fn(),
  joinGroupByInvite: vi.fn(),
  joinPublicGroup: vi.fn(),
  markConversationRead: vi.fn(),
  pinMessage: vi.fn(),
  subscribeChannel: vi.fn(),
  unsubscribeChannel: vi.fn(),
  unpinMessage: vi.fn(),
  createDirectConversation: vi.fn(),
  getContacts: vi.fn(),
  getBlockedUsers: vi.fn(),
  getCurrentUser: vi.fn(),
  addContact: vi.fn(),
  removeContact: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  updateCurrentUser: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../features/chats/api', () => ({
  createDirectConversation: mocks.createDirectConversation,
  getPinnedMessages: mocks.getPinnedMessages,
  joinGroupByInvite: mocks.joinGroupByInvite,
  joinPublicGroup: mocks.joinPublicGroup,
  markConversationRead: mocks.markConversationRead,
  pinMessage: mocks.pinMessage,
  subscribeChannel: mocks.subscribeChannel,
  unsubscribeChannel: mocks.unsubscribeChannel,
  unpinMessage: mocks.unpinMessage,
}));

vi.mock('../features/users/api', () => ({
  addContact: mocks.addContact,
  blockUser: mocks.blockUser,
  getBlockedUsers: mocks.getBlockedUsers,
  getContacts: mocks.getContacts,
  getCurrentUser: mocks.getCurrentUser,
  removeContact: mocks.removeContact,
  unblockUser: mocks.unblockUser,
  updateCurrentUser: mocks.updateCurrentUser,
}));

vi.mock('../features/users/useUserSearch', () => ({
  useUserSearch: mocks.useUserSearch,
}));

vi.mock('../features/chats/useConversations', () => ({
  useConversations: mocks.useConversations,
}));

vi.mock('../features/chats/useConversationDetails', () => ({
  useConversationDetails: mocks.useConversationDetails,
}));

vi.mock('../features/chats/useCreateConversation', () => ({
  useCreateConversation: mocks.useCreateConversation,
}));

vi.mock('../features/chats/useMessages', () => ({
  useMessages: mocks.useMessages,
}));

vi.mock('../features/notifications/useNotifications', () => ({
  useNotifications: mocks.useNotifications,
}));

vi.mock('../features/chats/useChatSocket', () => ({
  useChatSocket: mocks.useChatSocket,
}));

vi.mock('../features/notifications/components/NotificationMenu', () => ({
  NotificationMenu: (props: any) => (
    <div data-testid="notification-menu">
      <button type="button" onClick={props.onToggleOpen}>toggle notifications</button>
      <button type="button" onClick={props.onEnableBrowserNotifications}>enable browser notifications</button>
      <button type="button" onClick={props.onMarkAllRead}>mark all notifications</button>
      <button type="button" onClick={props.onClear}>clear notifications</button>
      {props.notifications[0] && (
        <button type="button" onClick={() => props.onSelect(props.notifications[0])}>select notification</button>
      )}
    </div>
  ),
}));

vi.mock('../features/chats/components/ConversationList', () => ({
  ConversationList: (props: any) => (
    <aside data-testid="conversation-list">
      <button type="button" onClick={props.onOpenProfile}>open profile</button>
      <button type="button" onClick={props.onLogout}>logout</button>
      <button type="button" onClick={() => props.onSearchChange('bob')}>change search</button>
      <button type="button" onClick={() => props.onInviteInputChange('invite-1')}>change invite</button>
      <button type="button" onClick={props.onJoinInvite}>join invite</button>
      <button type="button" onClick={props.onOpenCreateGroup}>new group</button>
      <button type="button" onClick={props.onOpenCreateChannel}>new channel</button>
      {props.conversations[0] && (
        <>
          <button type="button" onClick={() => props.onSelectConversation(props.conversations[0])}>select conversation</button>
          <button type="button" onClick={() => props.onTogglePinned(props.conversations[0])}>toggle conversation pin</button>
          <button type="button" onClick={() => props.onToggleMuted(props.conversations[0])}>toggle conversation mute</button>
          <button type="button" onClick={() => props.onArchive(props.conversations[0])}>archive conversation</button>
        </>
      )}
      {props.users[0] && (
        <>
          <button type="button" onClick={() => props.onStartDirect(props.users[0])}>start direct</button>
          <button type="button" onClick={() => props.onAddContact(props.users[0])}>add contact</button>
          <button type="button" onClick={() => props.onRemoveContact(props.users[0])}>remove contact</button>
          <button type="button" onClick={() => props.onBlockUser(props.users[0])}>block user</button>
          <button type="button" onClick={() => props.onUnblockUser(props.users[0])}>unblock user</button>
        </>
      )}
      {props.groupResults[0] && (
        <>
          <button type="button" onClick={() => props.onJoinGroup(props.groupResults[0])}>join group</button>
          <button type="button" onClick={() => props.onOpenJoinedGroup(props.groupResults[0])}>open joined group</button>
        </>
      )}
      {props.channelResults[0] && (
        <>
          <button type="button" onClick={() => props.onSubscribeChannel(props.channelResults[0])}>subscribe channel</button>
          <button type="button" onClick={() => props.onUnsubscribeChannel(props.channelResults[0])}>unsubscribe channel</button>
        </>
      )}
      {props.notificationSlot}
    </aside>
  ),
}));

vi.mock('../features/chats/components/ChatHeader', () => ({
  ChatHeader: (props: any) => (
    <header data-testid="chat-header">
      <span data-testid="typing-text">{props.typingText}</span>
      <button type="button" onClick={props.onBack}>back</button>
      <button type="button" onClick={props.onOpenDetails}>open details</button>
    </header>
  ),
}));

vi.mock('../features/chats/components/MessageList', () => ({
  MessageList: (props: any) => (
    <section data-testid="message-list">
      <button type="button" onClick={props.onLoadEarlier}>load earlier</button>
      <button type="button" onClick={props.onScroll}>scroll messages</button>
      {props.messages[0] && (
        <>
          <button type="button" onClick={() => props.onEdit(props.messages[0])}>edit message</button>
          <button type="button" onClick={() => props.onDelete(props.messages[0])}>delete message</button>
          <button type="button" onClick={() => props.onReact(props.messages[0], 'ok')}>react message</button>
          <button type="button" onClick={() => props.onReply(props.messages[0])}>reply message</button>
          <button type="button" onClick={() => props.onForward(props.messages[0])}>forward message</button>
          <button type="button" onClick={() => props.onTogglePin(props.messages[0])}>toggle message pin</button>
        </>
      )}
    </section>
  ),
}));

vi.mock('../features/chats/components/MessageComposer', () => ({
  MessageComposer: (props: any) => (
    <footer data-testid="message-composer">
      <span data-testid="composer-value">{props.value}</span>
      <span data-testid="composer-editing">{String(props.editing)}</span>
      <span data-testid="composer-reply">{props.replyTo?.content || ''}</span>
      <span data-testid="composer-disabled">{String(props.disabled)}</span>
      <input
        aria-label="composer input"
        value={props.value}
        onChange={event => props.onChange((event.target as HTMLInputElement).value)}
      />
      <button type="button" onClick={props.onSend}>send composer</button>
      <button type="button" onClick={props.onCancelEdit}>cancel edit</button>
      <button type="button" onClick={props.onCancelReply}>cancel reply</button>
      <button type="button" onClick={() => props.onRemoveAttachment('attachment-1')}>remove pending attachment</button>
    </footer>
  ),
}));

vi.mock('../features/groups/components/CreateGroupModal', () => ({
  CreateGroupModal: (props: any) => (
    <div data-testid="create-group-modal" data-open={String(props.open)}>
      <button type="button" onClick={props.onSubmit}>submit group</button>
      <button type="button" onClick={props.onClose}>close group</button>
    </div>
  ),
}));

vi.mock('../features/channels/components/CreateChannelModal', () => ({
  CreateChannelModal: (props: any) => (
    <div data-testid="create-channel-modal" data-open={String(props.open)}>
      <button type="button" onClick={props.onSubmit}>submit channel</button>
      <button type="button" onClick={props.onClose}>close channel</button>
    </div>
  ),
}));

vi.mock('../features/users/components/ProfileModal', () => ({
  ProfileModal: (props: any) => props.open ? (
    <div data-testid="profile-modal">
      <span>{props.username}</span>
      <button type="button" onClick={() => props.onUsernameChange('alice next')}>change profile username</button>
      <button type="button" onClick={() => props.onAvatarChange('https://example.com/avatar.png')}>change profile avatar</button>
      <button type="button" onClick={() => props.onSearchableChange(false)}>change searchable</button>
      <button type="button" onClick={() => props.onAllowDirectMessagesChange(false)}>change direct messages</button>
      <button type="button" onClick={props.onSubmit}>save profile</button>
      <button type="button" onClick={props.onClose}>close profile</button>
    </div>
  ) : null,
}));

vi.mock('../features/chats/components/ConversationDetails', () => ({
  ConversationDetails: (props: any) => (
    <aside data-testid="conversation-details" data-open={String(props.open)}>
      <button type="button" onClick={props.onClose}>close details</button>
      <button type="button" onClick={() => props.onLinkFilterChange('contact')}>filter contact links</button>
      <button type="button" onClick={props.onSaveGroupName}>save group name</button>
      <button type="button" onClick={props.onSaveAnnouncement}>save announcement</button>
      <button type="button" onClick={() => props.onAddMember({ id: 'user-3', username: 'carol', email: 'carol@example.com' })}>add member</button>
      <button type="button" onClick={() => props.onRemoveMember('user-2')}>remove member</button>
      <button type="button" onClick={props.onCreateInviteLink}>create invite link</button>
      <button type="button" onClick={() => props.onCopyInviteLink({ id: 'invite-1', code: 'abc' })}>copy invite link</button>
      <button type="button" onClick={() => props.onRevokeInviteLink('invite-1')}>revoke invite link</button>
    </aside>
  ),
}));

const currentUser: User = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  searchable: true,
  allowDirectMessages: true,
};

const bob: SearchUser = {
  id: 'user-2',
  username: 'bob',
  email: 'bob@example.com',
  status: 'offline',
};

const activeConversation: Conversation = {
  id: 'conversation-1',
  conversationId: 'conversation-1',
  type: 'group',
  name: 'Project Team',
  memberCount: 3,
  unreadCount: 1,
  announcement: 'Daily updates',
  lastActivityAt: '2026-06-13T08:00:00.000Z',
};

const activeMessage: Message = {
  id: 'message-1',
  content: 'Hello team',
  type: 'text',
  senderId: currentUser.id,
  conversationId: activeConversation.id,
  createdAt: '2026-06-13T08:00:00.000Z',
  sender: {
    id: currentUser.id,
    username: currentUser.username,
  },
};

let userSearchState: any;
let conversationsState: any;
let detailsState: any;
let createConversationState: any;
let messagesState: any;
let notificationsState: any;
let socketState: any;

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    ...activeConversation,
    ...overrides,
  };
}

function setupHookState(overrides: {
  currentUser?: User | null;
  activeConversation?: Conversation | null;
  messages?: Message[];
} = {}) {
  const nextCurrentUser = overrides.currentUser === undefined ? currentUser : overrides.currentUser;
  const conversation = overrides.activeConversation === undefined ? activeConversation : overrides.activeConversation;
  const messages = overrides.messages || [activeMessage];

  if (nextCurrentUser) {
    localStorage.setItem('token', 'token-1');
    localStorage.setItem('user', JSON.stringify(nextCurrentUser));
  } else {
    localStorage.clear();
  }

  userSearchState = {
    search: '',
    searchResults: [bob],
    groupResults: [{
      id: 'group-1',
      groupId: 'group-1',
      conversationId: 'conversation-group-1',
      name: 'Public Group',
      memberCount: 10,
      isJoined: false,
    }],
    channelResults: [{
      id: 'channel-1',
      channelId: 'channel-1',
      conversationId: 'conversation-channel-1',
      name: 'Announcements',
      memberCount: 20,
      isSubscribed: false,
    }],
    discoveryActionLoading: '',
    groupSearch: '',
    groupSearchResults: [bob],
    memberSearch: '',
    memberSearchResults: [bob],
    setSearch: vi.fn(),
    setDiscoveryActionLoading: vi.fn(),
    setGroupSearch: vi.fn(),
    setMemberSearch: vi.fn(),
    setMemberSearchResults: vi.fn(),
    clearSidebarSearch: vi.fn(),
    clearGroupSearch: vi.fn(),
    patchSearchUser: vi.fn(),
    markChannelSubscribed: vi.fn(),
    markChannelUnsubscribed: vi.fn(),
    markGroupJoined: vi.fn(),
  };

  conversationsState = {
    conversations: conversation ? [conversation] : [],
    activeConversation: conversation,
    loadingConversations: false,
    sidebarError: '',
    conversationsRef: { current: conversation ? [conversation] : [] },
    setSidebarError: vi.fn(),
    setActiveConversation: vi.fn(),
    upsertConversation: vi.fn(),
    removeConversation: vi.fn(),
    updateActiveConversation: vi.fn(),
    applyConversationRead: vi.fn(),
    applyMessageActivity: vi.fn(),
    applyLastMessageUpdate: vi.fn(),
    applySentMessage: vi.fn(),
    applyForwardedMessage: vi.fn(),
    applyPresenceUpdate: vi.fn(),
    applyDirectUserUpdate: vi.fn(),
    applyMemberCount: vi.fn(),
    applyConversationPatch: vi.fn(),
    updateConversationSetting: vi.fn().mockResolvedValue([conversation].filter(Boolean)),
  };

  detailsState = {
    detailsOpen: false,
    members: [],
    membersLoading: false,
    detailsError: '',
    detailsNotice: '',
    mediaAttachments: [],
    fileAttachments: [],
    linkPreviews: [],
    linkFilter: 'all',
    attachmentsLoading: false,
    groupNameDraft: conversation?.name || '',
    announcementDraft: conversation?.announcement || '',
    inviteLinks: [],
    inviteLoading: false,
    memberSearch: '',
    memberSearchResults: [bob],
    setGroupNameDraft: vi.fn(),
    setAnnouncementDraft: vi.fn(),
    setMemberSearch: vi.fn(),
    setMemberSearchResults: vi.fn(),
    openDetails: vi.fn().mockResolvedValue(undefined),
    closeDetails: vi.fn(),
    resetDetails: vi.fn(),
    changeLinkFilter: vi.fn().mockResolvedValue(undefined),
    createInviteLink: vi.fn().mockResolvedValue(undefined),
    copyInviteLink: vi.fn().mockResolvedValue(undefined),
    revokeInviteLink: vi.fn().mockResolvedValue(undefined),
    saveGroupName: vi.fn().mockResolvedValue(undefined),
    saveAnnouncement: vi.fn().mockResolvedValue(undefined),
    addMember: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    applyProfileUpdate: vi.fn(),
  };

  createConversationState = {
    createGroupOpen: false,
    createChannelOpen: false,
    groupName: '',
    selectedMembers: [],
    createError: '',
    creatingGroup: false,
    channelName: '',
    channelDescription: '',
    channelError: '',
    creatingChannel: false,
    setGroupName: vi.fn(),
    setChannelName: vi.fn(),
    setChannelDescription: vi.fn(),
    openCreateGroup: vi.fn(),
    closeCreateGroup: vi.fn(),
    openCreateChannel: vi.fn(),
    closeCreateChannel: vi.fn(),
    toggleMember: vi.fn(),
    submitGroup: vi.fn().mockResolvedValue(undefined),
    submitChannel: vi.fn().mockResolvedValue(undefined),
  };

  messagesState = {
    messages,
    loadingMessages: false,
    loadingEarlier: false,
    hasMoreMessages: true,
    unreadMarkerId: null,
    showJumpLatest: false,
    messageError: '',
    messageSearch: '',
    messageSearchResults: [messages[0]].filter(Boolean),
    searchingMessages: false,
    sending: false,
    setMessageError: vi.fn(),
    setUnreadMarkerId: vi.fn(),
    setShowJumpLatest: vi.fn(),
    resetMessages: vi.fn(),
    loadConversationMessages: vi.fn().mockResolvedValue(undefined),
    sendCurrentMessage: vi.fn().mockResolvedValue({ mode: 'send', message: messages[0] }),
    forwardCurrentMessage: vi.fn().mockResolvedValue(undefined),
    deleteCurrentMessage: vi.fn().mockResolvedValue({ ...messages[0], deletedAt: '2026-06-13T08:10:00.000Z' }),
    reactToMessage: vi.fn().mockResolvedValue(undefined),
    searchConversationMessages: vi.fn().mockResolvedValue(undefined),
    uploadAttachments: vi.fn().mockResolvedValue([]),
    loadEarlierMessages: vi.fn().mockResolvedValue(undefined),
    applyIncomingMessage: vi.fn(),
    applyUpdatedMessage: vi.fn(),
    applyProfileUpdate: vi.fn(),
    ensureMessageVisible: vi.fn(),
    clearMessageSearch: vi.fn(),
  };

  notificationsState = {
    notifications: [{
      id: 'notification-1',
      conversationId: conversation?.id || 'conversation-1',
      type: 'message',
      title: 'Project Team',
      body: 'Hello team',
      read: false,
      createdAt: '2026-06-13T08:00:00.000Z',
    }],
    notificationsOpen: false,
    unreadNotificationCount: 1,
    browserNotificationState: 'default',
    setNotificationsOpen: vi.fn(),
    markConversationNotificationsLocalRead: vi.fn(),
    receiveNotification: vi.fn(),
    enableBrowserNotifications: vi.fn().mockResolvedValue(undefined),
    selectNotification: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn(),
    clearNotifications: vi.fn(),
    showBrowserNotification: vi.fn(),
  };

  socketState = {
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
  };

  mocks.useUserSearch.mockReturnValue(userSearchState);
  mocks.useConversations.mockReturnValue(conversationsState);
  mocks.useConversationDetails.mockReturnValue(detailsState);
  mocks.useCreateConversation.mockReturnValue(createConversationState);
  mocks.useMessages.mockReturnValue(messagesState);
  mocks.useNotifications.mockReturnValue(notificationsState);
  mocks.useChatSocket.mockReturnValue(socketState);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setupHookState();

  mocks.getPinnedMessages.mockResolvedValue([]);
  mocks.joinGroupByInvite.mockResolvedValue(createConversation({ id: 'conversation-invite', conversationId: 'conversation-invite' }));
  mocks.joinPublicGroup.mockResolvedValue(createConversation({ id: 'conversation-group-1', conversationId: 'conversation-group-1', role: 'member', memberCount: 11 }));
  mocks.markConversationRead.mockResolvedValue({ lastReadAt: '2026-06-13T08:05:00.000Z' });
  mocks.pinMessage.mockResolvedValue({ pinnedMessages: [{ messageId: activeMessage.id, message: activeMessage }] });
  mocks.subscribeChannel.mockResolvedValue(createConversation({ id: 'conversation-channel-1', conversationId: 'conversation-channel-1', type: 'channel', role: 'subscriber', memberCount: 21 }));
  mocks.unsubscribeChannel.mockResolvedValue(undefined);
  mocks.unpinMessage.mockResolvedValue({ pinnedMessages: [] });
  mocks.createDirectConversation.mockResolvedValue(createConversation({ id: 'conversation-direct', conversationId: 'conversation-direct', type: 'direct', user: bob }));
  mocks.getContacts.mockResolvedValue([]);
  mocks.getBlockedUsers.mockResolvedValue([]);
  mocks.getCurrentUser.mockResolvedValue(currentUser);
  mocks.addContact.mockResolvedValue([]);
  mocks.removeContact.mockResolvedValue([]);
  mocks.blockUser.mockResolvedValue([]);
  mocks.unblockUser.mockResolvedValue([]);
  mocks.updateCurrentUser.mockResolvedValue({ ...currentUser, username: 'alice next' });
});

afterEach(() => {
  cleanup();
});

describe('ChatPage orchestration', () => {
  it('redirects unauthenticated users without requiring a real current user in hooks', async () => {
    setupHookState({ currentUser: null, activeConversation: null, messages: [] });

    render(<ChatPage />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
    expect(mocks.useConversationDetails).toHaveBeenCalledWith(expect.objectContaining({
      currentUser: { id: '', username: '', email: '' },
    }));
  });

  it('selects conversations through the sidebar and prepares the message/details state', async () => {
    render(<ChatPage />);

    fireEvent.click(screen.getByText('select conversation'));

    await waitFor(() => {
      expect(messagesState.loadConversationMessages).toHaveBeenCalledWith({
        conversation: activeConversation,
        currentUserId: currentUser.id,
      });
    });
    expect(conversationsState.setActiveConversation).toHaveBeenCalledWith(activeConversation);
    expect(messagesState.resetMessages).toHaveBeenCalledTimes(1);
    expect(detailsState.resetDetails).toHaveBeenCalledTimes(1);
    expect(notificationsState.markConversationNotificationsLocalRead).toHaveBeenCalledWith(activeConversation.id);
    expect(mocks.getPinnedMessages).toHaveBeenCalledWith(activeConversation.id);
  });

  it('wires message list and composer events into message actions', async () => {
    messagesState.sendCurrentMessage.mockResolvedValue({ mode: 'edit', message: activeMessage });
    render(<ChatPage />);

    fireEvent.click(screen.getByText('edit message'));

    expect(screen.getByTestId('composer-editing').textContent).toBe('true');
    expect(screen.getByTestId('composer-value').textContent).toBe(activeMessage.content);

    fireEvent.click(screen.getByText('send composer'));

    await waitFor(() => {
      expect(messagesState.sendCurrentMessage).toHaveBeenCalledWith(expect.objectContaining({
        conversation: activeConversation,
        content: activeMessage.content,
        editingMessage: activeMessage,
      }));
    });

    fireEvent.click(screen.getByText('reply message'));
    expect(screen.getByTestId('composer-reply').textContent).toBe(activeMessage.content);

    fireEvent.change(screen.getByLabelText('composer input'), { target: { value: 'next draft' } });
    expect(socketState.startTyping).toHaveBeenCalledWith(activeConversation.id);

    fireEvent.click(screen.getByText('forward message'));
    fireEvent.click(screen.getByText('delete message'));
    fireEvent.click(screen.getByText('react message'));
    fireEvent.click(screen.getByText('toggle message pin'));
    fireEvent.click(screen.getByText('load earlier'));
    fireEvent.click(screen.getByText('scroll messages'));

    await waitFor(() => {
      expect(messagesState.forwardCurrentMessage).toHaveBeenCalledWith(activeMessage, activeConversation);
      expect(messagesState.deleteCurrentMessage).toHaveBeenCalledWith(activeMessage);
      expect(messagesState.reactToMessage).toHaveBeenCalledWith(activeMessage, 'ok');
      expect(mocks.pinMessage).toHaveBeenCalledWith(activeMessage.id);
      expect(messagesState.loadEarlierMessages).toHaveBeenCalledWith(activeConversation);
    });
    expect(messagesState.setShowJumpLatest).toHaveBeenCalled();
  });

  it('wires sidebar discovery, relationship, and settings actions', async () => {
    render(<ChatPage />);

    fireEvent.click(screen.getByText('change search'));
    fireEvent.click(screen.getByText('change invite'));
    fireEvent.click(screen.getByText('join invite'));
    fireEvent.click(screen.getByText('start direct'));
    fireEvent.click(screen.getByText('add contact'));
    fireEvent.click(screen.getByText('remove contact'));
    fireEvent.click(screen.getByText('block user'));
    fireEvent.click(screen.getByText('unblock user'));
    fireEvent.click(screen.getByText('join group'));
    fireEvent.click(screen.getByText('subscribe channel'));
    fireEvent.click(screen.getByText('unsubscribe channel'));
    fireEvent.click(screen.getByText('toggle conversation pin'));
    fireEvent.click(screen.getByText('toggle conversation mute'));
    fireEvent.click(screen.getByText('archive conversation'));

    await waitFor(() => {
      expect(userSearchState.setSearch).toHaveBeenCalledWith('bob');
      expect(mocks.joinGroupByInvite).toHaveBeenCalledWith('invite-1');
      expect(mocks.createDirectConversation).toHaveBeenCalledWith(bob.id);
      expect(mocks.addContact).toHaveBeenCalledWith(bob.id);
      expect(mocks.removeContact).toHaveBeenCalledWith(bob.id);
      expect(mocks.blockUser).toHaveBeenCalledWith(bob.id);
      expect(mocks.unblockUser).toHaveBeenCalledWith(bob.id);
      expect(mocks.joinPublicGroup).toHaveBeenCalledWith('conversation-group-1');
      expect(mocks.subscribeChannel).toHaveBeenCalledWith('conversation-channel-1');
      expect(mocks.unsubscribeChannel).toHaveBeenCalledWith('conversation-channel-1');
    });

    expect(conversationsState.updateConversationSetting).toHaveBeenCalledWith(activeConversation, 'pinned');
    expect(conversationsState.updateConversationSetting).toHaveBeenCalledWith(activeConversation, 'muted');
    expect(conversationsState.updateConversationSetting).toHaveBeenCalledWith(activeConversation, 'archived');
    expect(userSearchState.markGroupJoined).toHaveBeenCalled();
    expect(userSearchState.markChannelSubscribed).toHaveBeenCalled();
    expect(userSearchState.markChannelUnsubscribed).toHaveBeenCalled();
  });

  it('wires details, profile, modal, and notification actions', async () => {
    render(<ChatPage />);

    fireEvent.click(screen.getByText('new group'));
    fireEvent.click(screen.getByText('new channel'));
    fireEvent.click(screen.getByText('submit group'));
    fireEvent.click(screen.getByText('submit channel'));
    fireEvent.click(screen.getByText('open details'));
    fireEvent.click(screen.getByText('filter contact links'));
    fireEvent.click(screen.getByText('save group name'));
    fireEvent.click(screen.getByText('save announcement'));
    fireEvent.click(screen.getByText('add member'));
    fireEvent.click(screen.getByText('remove member'));
    fireEvent.click(screen.getByText('create invite link'));
    fireEvent.click(screen.getByText('copy invite link'));
    fireEvent.click(screen.getByText('revoke invite link'));
    fireEvent.click(screen.getByText('toggle notifications'));
    fireEvent.click(screen.getByText('enable browser notifications'));
    fireEvent.click(screen.getByText('mark all notifications'));
    fireEvent.click(screen.getByText('clear notifications'));
    fireEvent.click(screen.getByText('select notification'));

    expect(createConversationState.openCreateGroup).toHaveBeenCalledTimes(1);
    expect(createConversationState.openCreateChannel).toHaveBeenCalledTimes(1);
    expect(createConversationState.submitGroup).toHaveBeenCalledTimes(1);
    expect(createConversationState.submitChannel).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(detailsState.openDetails).toHaveBeenCalledWith(activeConversation);
      expect(detailsState.changeLinkFilter).toHaveBeenCalledWith(activeConversation, 'contact');
      expect(detailsState.saveGroupName).toHaveBeenCalledWith(activeConversation);
      expect(detailsState.saveAnnouncement).toHaveBeenCalledWith(activeConversation);
      expect(detailsState.addMember).toHaveBeenCalledWith(activeConversation, expect.objectContaining({ id: 'user-3' }));
      expect(detailsState.removeMember).toHaveBeenCalledWith(activeConversation, 'user-2');
      expect(detailsState.createInviteLink).toHaveBeenCalledWith(activeConversation);
      expect(detailsState.copyInviteLink).toHaveBeenCalledWith(expect.objectContaining({ code: 'abc' }));
      expect(detailsState.revokeInviteLink).toHaveBeenCalledWith(activeConversation, 'invite-1');
    });

    expect(notificationsState.setNotificationsOpen).toHaveBeenCalled();
    expect(notificationsState.enableBrowserNotifications).toHaveBeenCalledTimes(1);
    expect(notificationsState.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(notificationsState.clearNotifications).toHaveBeenCalledTimes(1);
    expect(notificationsState.selectNotification).toHaveBeenCalledWith(notificationsState.notifications[0]);

    fireEvent.click(screen.getByText('open profile'));
    expect(screen.getByTestId('profile-modal')).toBeTruthy();

    fireEvent.click(screen.getByText('change profile username'));
    fireEvent.click(screen.getByText('change profile avatar'));
    fireEvent.click(screen.getByText('change searchable'));
    fireEvent.click(screen.getByText('change direct messages'));
    fireEvent.click(screen.getByText('save profile'));

    await waitFor(() => {
      expect(mocks.updateCurrentUser).toHaveBeenCalledWith({
        username: 'alice next',
        avatar: 'https://example.com/avatar.png',
        searchable: false,
        allowDirectMessages: false,
      });
    });
    expect(messagesState.applyProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice next' }));
    expect(detailsState.applyProfileUpdate).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice next' }));
  });
});
