import { Archive, BellOff, Link2, LogOut, MessageCircle, Pin, PinOff, Plus, Search, Settings, Users } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import { formatConversationTime } from '../../../shared/utils/time';
import type { User } from '../../auth/types';
import type { SearchUser } from '../../users/types';
import type { Conversation } from '../types';

type ConversationListProps = {
  currentUser: User;
  conversations: Conversation[];
  activeConversationId?: string;
  search: string;
  users: SearchUser[];
  loading: boolean;
  error: string;
  inviteInput: string;
  joiningInvite: boolean;
  onSearchChange: (value: string) => void;
  onInviteInputChange: (value: string) => void;
  onJoinInvite: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onStartDirect: (user: SearchUser) => void;
  onOpenCreateGroup: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onTogglePinned: (conversation: Conversation) => void;
  onToggleMuted: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
};

export function ConversationList({
  currentUser,
  conversations,
  activeConversationId,
  search,
  users,
  loading,
  error,
  inviteInput,
  joiningInvite,
  onSearchChange,
  onInviteInputChange,
  onJoinInvite,
  onSelectConversation,
  onStartDirect,
  onOpenCreateGroup,
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
              <button className="conversation-row" key={user.id} type="button" onClick={() => onStartDirect(user)}>
                <Avatar name={user.username} src={user.avatar} status={user.status} />
                <span className="conversation-main">
                  <strong>{user.username}</strong>
                  <small>{user.email}</small>
                </span>
                <MessageCircle size={17} />
              </button>
            ))}
          </section>
        )}

        <section>
          {users.length > 0 && <div className="section-label">Chats</div>}
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
                  <small>{conversation.lastMessage?.content || (conversation.type === 'group' ? `${conversation.memberCount} members` : 'Direct message')}</small>
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
