import { Copy, Link2, Plus, Trash2, X } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import type { User } from '../../auth/types';
import type { SearchUser } from '../../users/types';
import type { Conversation, GroupMember, InviteLink } from '../types';

type ConversationDetailsProps = {
  open: boolean;
  currentUser: User;
  conversation: Conversation | null;
  members: GroupMember[];
  memberSearch: string;
  memberSearchResults: SearchUser[];
  groupNameDraft: string;
  inviteLinks: InviteLink[];
  inviteLinkBaseUrl: string;
  inviteLoading: boolean;
  loading: boolean;
  error: string;
  notice: string;
  onClose: () => void;
  onMemberSearchChange: (value: string) => void;
  onGroupNameDraftChange: (value: string) => void;
  onSaveGroupName: () => void;
  onAddMember: (user: SearchUser) => void;
  onRemoveMember: (userId: string) => void;
  onCreateInviteLink: () => void;
  onCopyInviteLink: (invite: InviteLink) => void;
  onRevokeInviteLink: (inviteId: string) => void;
};

export function ConversationDetails({
  open,
  currentUser,
  conversation,
  members,
  memberSearch,
  memberSearchResults,
  groupNameDraft,
  inviteLinks,
  inviteLinkBaseUrl,
  inviteLoading,
  loading,
  error,
  notice,
  onClose,
  onMemberSearchChange,
  onGroupNameDraftChange,
  onSaveGroupName,
  onAddMember,
  onRemoveMember,
  onCreateInviteLink,
  onCopyInviteLink,
  onRevokeInviteLink,
}: ConversationDetailsProps) {
  if (!open || !conversation) return null;

  const isGroup = conversation.type === 'group';
  const currentMember = members.find(member => member.userId === currentUser.id);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const existingIds = new Set(members.map(member => member.userId));

  return (
    <aside className="details-drawer">
      <header className="details-header">
        <h2>Details</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close details" title="Close details">
          <X size={18} />
        </button>
      </header>

      <div className="details-body">
        <div className="details-profile">
          <Avatar name={conversation.name} src={conversation.avatar} status={conversation.user?.status} size="lg" />
          <strong>{conversation.name}</strong>
          <span>{isGroup ? `${conversation.memberCount} members` : conversation.user?.email}</span>
        </div>

        {isGroup && canManage && (
          <div className="details-section">
            <label>Group name</label>
            <div className="inline-edit">
              <input value={groupNameDraft} onChange={event => onGroupNameDraftChange(event.target.value)} />
              <button type="button" onClick={onSaveGroupName}>Save</button>
            </div>
          </div>
        )}

        {isGroup && (
          <>
            <div className="details-section">
              <label>Members</label>
              {loading && <div className="state-banner">Loading members...</div>}
              {members.map(member => (
                <div className="member-row" key={member.id}>
                  <Avatar name={member.user.username} src={member.user.avatar} status={member.user.status} />
                  <span>
                    <strong>{member.user.username}</strong>
                    <small>{member.role}</small>
                  </span>
                  {canManage && member.role !== 'owner' && member.userId !== currentUser.id && (
                    <button className="mini-icon-button" type="button" onClick={() => onRemoveMember(member.userId)} title="Remove member">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canManage && (
              <div className="details-section">
                <label>Add people</label>
                <input
                  className="text-field"
                  value={memberSearch}
                  onChange={event => onMemberSearchChange(event.target.value)}
                  placeholder="Search users"
                />
                <div className="details-results">
                  {memberSearchResults
                    .filter(user => !existingIds.has(user.id))
                    .map(user => (
                      <button type="button" className="member-row" key={user.id} onClick={() => onAddMember(user)}>
                        <Avatar name={user.username} src={user.avatar} status={user.status} />
                        <span>
                          <strong>{user.username}</strong>
                          <small>{user.email}</small>
                        </span>
                        <Plus size={16} />
                      </button>
                    ))}
                </div>
              </div>
            )}

            {canManage && (
              <div className="details-section">
                <div className="details-section-header">
                  <label>Invite links</label>
                  <button
                    className="mini-icon-button"
                    type="button"
                    onClick={onCreateInviteLink}
                    disabled={inviteLoading}
                    title="Create invite link"
                  >
                    <Link2 size={15} />
                  </button>
                </div>
                {inviteLoading && <div className="state-banner flush">Loading invites...</div>}
                <div className="invite-list">
                  {inviteLinks.map(invite => {
                    const revoked = Boolean(invite.revokedAt);
                    const expired = invite.expiresAt ? new Date(invite.expiresAt) <= new Date() : false;
                    const status = revoked ? 'Revoked' : expired ? 'Expired' : `${invite.usedCount} uses`;
                    return (
                      <div className={`invite-row ${revoked || expired ? 'inactive' : ''}`} key={invite.id}>
                        <span>
                          <strong>{inviteLinkBaseUrl}{invite.code}</strong>
                          <small>{status}</small>
                        </span>
                        <button
                          className="mini-icon-button"
                          type="button"
                          onClick={() => onCopyInviteLink(invite)}
                          disabled={revoked || expired}
                          title="Copy invite link"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="mini-icon-button"
                          type="button"
                          onClick={() => onRevokeInviteLink(invite.id)}
                          disabled={revoked}
                          title="Revoke invite link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {!inviteLoading && inviteLinks.length === 0 && (
                    <div className="state-banner flush">No invite links</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="state-banner error">{error}</div>}
        {notice && !error && <div className="state-banner">{notice}</div>}
      </div>
    </aside>
  );
}
