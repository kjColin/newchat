import { Archive, BellOff, Link2, LogOut, MessageCircle, Pin, PinOff, Plus, Radio, Search, Settings, ShieldOff, UserCheck, UserMinus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '../../../shared/components/Avatar';
import { formatConversationTime } from '../../../shared/utils/time';
import type { User } from '../../auth/types';
import type { BlockedUserEntry, ContactEntry, SearchUser } from '../../users/types';
import type { ChannelDiscoveryItem, Conversation, GroupDiscoveryItem } from '../types';

type ConversationListProps = {
  currentUser: User;
  notificationSlot?: ReactNode;
  conversations: Conversation[];
  activeConversationId?: string;
  search: string;
  users: SearchUser[];
  groupResults: GroupDiscoveryItem[];
  channelResults: ChannelDiscoveryItem[];
  contacts: ContactEntry[];
  blockedUsers: BlockedUserEntry[];
  loading: boolean;
  error: string;
  inviteInput: string;
  joiningInvite: boolean;
  discoveryActionLoading: string;
  onSearchChange: (value: string) => void;
  onInviteInputChange: (value: string) => void;
  onJoinInvite: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onStartDirect: (user: SearchUser) => void;
  onAddContact: (user: SearchUser) => void;
  onRemoveContact: (user: SearchUser) => void;
  onBlockUser: (user: SearchUser) => void;
  onUnblockUser: (user: SearchUser) => void;
  onJoinGroup: (group: GroupDiscoveryItem) => void;
  onOpenJoinedGroup: (group: GroupDiscoveryItem) => void;
  onSubscribeChannel: (channel: ChannelDiscoveryItem) => void;
  onUnsubscribeChannel: (channel: ChannelDiscoveryItem) => void;
  onOpenCreateGroup: () => void;
  onOpenCreateChannel: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onTogglePinned: (conversation: Conversation) => void;
  onToggleMuted: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
};

export function ConversationList({
  currentUser,
  notificationSlot,
  conversations,
  activeConversationId,
  search,
  users,
  groupResults,
  channelResults,
  contacts,
  blockedUsers,
  loading,
  error,
  inviteInput,
  joiningInvite,
  discoveryActionLoading,
  onSearchChange,
  onInviteInputChange,
  onJoinInvite,
  onSelectConversation,
  onStartDirect,
  onAddContact,
  onRemoveContact,
  onBlockUser,
  onUnblockUser,
  onJoinGroup,
  onOpenJoinedGroup,
  onSubscribeChannel,
  onUnsubscribeChannel,
  onOpenCreateGroup,
  onOpenCreateChannel,
  onOpenProfile,
  onLogout,
  onTogglePinned,
  onToggleMuted,
  onArchive,
}: ConversationListProps) {
  const query = search.trim().toLowerCase();
  const filteredConversations = query
    ? conversations.filter(conversation =>
        conversation.name.toLowerCase().includes(query) ||
        conversation.lastMessage?.content.toLowerCase().includes(query)
      )
    : conversations;

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-topbar">
        <button className="account-chip" type="button" onClick={onOpenProfile} title="Edit profile">
          <Avatar name={currentUser.username} src={currentUser.avatar} status="online" size="sm" />
          <span className="account-copy">
            <strong>{currentUser.username}</strong>
            <span>{currentUser.email}</span>
          </span>
          <Settings size={15} />
        </button>
        {notificationSlot}
        <button className="icon-button" type="button" onClick={onLogout} aria-label="Logout" title="Logout">
          <LogOut size={18} />
        </button>
      </div>

      <div className="sidebar-actions">
        <label className="search-field">
          <Search size={17} />
          <input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search"
          />
        </label>
        <button className="icon-button primary" type="button" onClick={onOpenCreateGroup} aria-label="New group" title="New group">
          <Plus size={19} />
        </button>
        <button className="icon-button" type="button" onClick={onOpenCreateChannel} aria-label="New channel" title="New channel">
          <Radio size={18} />
        </button>
      </div>

      <form
        className="invite-join"
        onSubmit={event => {
          event.preventDefault();
          onJoinInvite();
        }}
      >
        <label className="search-field">
          <Link2 size={17} />
          <input
            value={inviteInput}
            onChange={event => onInviteInputChange(event.target.value)}
            placeholder="Invite code or link"
          />
        </label>
        <button
          className="icon-button"
          type="submit"
          disabled={joiningInvite || inviteInput.trim().length === 0}
          aria-label="Join invite"
          title="Join invite"
        >
          <Users size={18} />
        </button>
      </form>

      <div className="conversation-scroll">
        {error && <div className="state-banner error">{error}</div>}
        {loading && <div className="state-banner">Loading chats...</div>}

        {users.length > 0 && (
          <section className="search-results">
            <div className="section-label">People</div>
            {users.map(user => (
              <div className="conversation-row" key={user.id}>
                <Avatar name={user.username} src={user.avatar} status={user.status} />
                <span className="conversation-main">
                  <strong>{user.username}</strong>
                  <small>{user.isBlocked ? 'Blocked' : user.isContact ? 'Contact' : user.email}</small>
                </span>
                <span className="user-actions">
                  <button className="mini-icon-button" type="button" onClick={() => onStartDirect(user)} disabled={user.isBlocked} title="Message">
                    <MessageCircle size={14} />
                  </button>
                  {user.isContact ? (
                    <button className="mini-icon-button" type="button" onClick={() => onRemoveContact(user)} title="Remove contact">
                      <UserMinus size={14} />
                    </button>
                  ) : (
                    <button className="mini-icon-button" type="button" onClick={() => onAddContact(user)} disabled={user.isBlocked} title="Add contact">
                      <UserCheck size={14} />
                    </button>
                  )}
                  {user.isBlocked ? (
                    <button className="mini-icon-button" type="button" onClick={() => onUnblockUser(user)} title="Unblock">
                      <ShieldOff size={14} />
                    </button>
                  ) : (
                    <button className="mini-icon-button danger" type="button" onClick={() => onBlockUser(user)} title="Block">
                      <ShieldOff size={14} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        {channelResults.length > 0 && (
          <section className="search-results">
            <div className="section-label">Channels</div>
            {channelResults.map(channel => (
              <div className="conversation-row" key={channel.id}>
                <Avatar name={channel.name} src={channel.avatar} />
                <span className="conversation-main">
                  <strong>{channel.name}</strong>
                  <small>{channel.description || `${channel.memberCount} subscribers`}</small>
                </span>
                <span className="user-actions">
                  {channel.isSubscribed ? (
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={() => onUnsubscribeChannel(channel)}
                      disabled={discoveryActionLoading === channel.conversationId || channel.role === 'owner'}
                      title={channel.role === 'owner' ? 'Owner cannot leave' : 'Leave channel'}
                    >
                      <LogOut size={14} />
                    </button>
                  ) : (
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={() => onSubscribeChannel(channel)}
                      disabled={discoveryActionLoading === channel.conversationId}
                      title="Subscribe"
                    >
                      <Radio size={14} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        {groupResults.length > 0 && (
          <section className="search-results">
            <div className="section-label">Groups</div>
            {groupResults.map(group => (
              <div className="conversation-row" key={group.id}>
                <Avatar name={group.name} src={group.avatar} />
                <span className="conversation-main">
                  <strong>{group.name}</strong>
                  <small>{group.announcement || `${group.memberCount} members`}</small>
                </span>
                <span className="user-actions">
                  {group.isJoined ? (
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={() => onOpenJoinedGroup(group)}
                      disabled={discoveryActionLoading === group.conversationId}
                      title="Open group"
                    >
                      <MessageCircle size={14} />
                    </button>
                  ) : (
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={() => onJoinGroup(group)}
                      disabled={discoveryActionLoading === group.conversationId}
                      title="Join group"
                    >
                      <Users size={14} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        {!query && contacts.length > 0 && (
          <section className="search-results">
            <div className="section-label">Contacts</div>
            {contacts.map(contact => (
              <div className="conversation-row" key={contact.user.id}>
                <Avatar name={contact.user.username} src={contact.user.avatar} status={contact.user.status} />
                <span className="conversation-main">
                  <strong>{contact.alias || contact.user.username}</strong>
                  <small>{contact.user.email}</small>
                </span>
                <span className="user-actions">
                  <button className="mini-icon-button" type="button" onClick={() => onStartDirect(contact.user)} title="Message">
                    <MessageCircle size={14} />
                  </button>
                  <button className="mini-icon-button" type="button" onClick={() => onRemoveContact(contact.user)} title="Remove contact">
                    <UserMinus size={14} />
                  </button>
                  <button className="mini-icon-button danger" type="button" onClick={() => onBlockUser(contact.user)} title="Block">
                    <ShieldOff size={14} />
                  </button>
                </span>
              </div>
            ))}
          </section>
        )}

        {!query && blockedUsers.length > 0 && (
          <section className="search-results">
            <div className="section-label">Blocked</div>
            {blockedUsers.map(block => (
              <div className="conversation-row" key={block.user.id}>
                <Avatar name={block.user.username} src={block.user.avatar} status={block.user.status} />
                <span className="conversation-main">
                  <strong>{block.user.username}</strong>
                  <small>{block.user.email}</small>
                </span>
                <span className="user-actions">
                  <button className="mini-icon-button" type="button" onClick={() => onUnblockUser(block.user)} title="Unblock">
                    <ShieldOff size={14} />
                  </button>
                </span>
              </div>
            ))}
          </section>
        )}

        <section>
          {(users.length > 0 || groupResults.length > 0 || channelResults.length > 0 || contacts.length > 0 || blockedUsers.length > 0) && <div className="section-label">Chats</div>}
          {!loading && filteredConversations.length === 0 ? (
            <div className="empty-list">
              <Users size={28} />
              <span>No chats yet</span>
            </div>
          ) : (
            filteredConversations.map(conversation => {
              const isMuted = conversation.mutedUntil && new Date(conversation.mutedUntil) > new Date();
              return (
              <div
                className={`conversation-row ${activeConversationId === conversation.id ? 'active' : ''}`}
                key={conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConversation(conversation)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectConversation(conversation);
                  }
                }}
              >
                <Avatar name={conversation.name} src={conversation.avatar} status={conversation.user?.status} />
                <span className="conversation-main">
                  <strong>{conversation.name}</strong>
                  <small>
                    {conversation.lastMessage?.content ||
                      (conversation.type === 'channel'
                        ? `${conversation.memberCount} subscribers`
                        : conversation.type === 'group'
                          ? `${conversation.memberCount} members`
                          : 'Direct message')}
                  </small>
                </span>
                <span className="conversation-meta conversation-actions">
                  <span>{formatConversationTime(conversation.lastMessage?.createdAt || conversation.lastActivityAt)}</span>
                  <span className="conversation-badges">
                    {conversation.pinnedAt && <Pin size={12} />}
                    {isMuted && <BellOff size={12} />}
                    {(conversation.unreadCount || 0) > 0 && <strong className="unread-badge">{conversation.unreadCount}</strong>}
                  </span>
                  <span className="row-actions">
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        onTogglePinned(conversation);
                      }}
                      title={conversation.pinnedAt ? 'Unpin' : 'Pin'}
                    >
                      {conversation.pinnedAt ? <PinOff size={13} /> : <Pin size={13} />}
                    </button>
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        onToggleMuted(conversation);
                      }}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      <BellOff size={13} />
                    </button>
                    <button
                      className="mini-icon-button"
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        onArchive(conversation);
                      }}
                      title="Archive"
                    >
                      <Archive size={13} />
                    </button>
                  </span>
                </span>
              </div>
            );
            })
          )}
        </section>
      </div>
    </aside>
  );
}
