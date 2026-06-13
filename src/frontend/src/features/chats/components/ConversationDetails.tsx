import { Copy, FileText, Link2, Plus, Trash2, X } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import type { User } from '../../auth/types';
import type { SearchUser } from '../../users/types';
import type { Attachment, Conversation, GroupMember, InviteLink, LinkPreview } from '../types';

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

type ConversationDetailsProps = {
  open: boolean;
  currentUser: User;
  conversation: Conversation | null;
  members: GroupMember[];
  memberSearch: string;
  memberSearchResults: SearchUser[];
  groupNameDraft: string;
  announcementDraft: string;
  inviteLinks: InviteLink[];
  inviteLinkBaseUrl: string;
  inviteLoading: boolean;
  mediaAttachments: Attachment[];
  fileAttachments: Attachment[];
  linkPreviews: LinkPreview[];
  attachmentsLoading: boolean;
  loading: boolean;
  error: string;
  notice: string;
  onClose: () => void;
  onMemberSearchChange: (value: string) => void;
  onGroupNameDraftChange: (value: string) => void;
  onAnnouncementDraftChange: (value: string) => void;
  onSaveGroupName: () => void;
  onSaveAnnouncement: () => void;
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
  announcementDraft,
  inviteLinks,
  inviteLinkBaseUrl,
  inviteLoading,
  mediaAttachments,
  fileAttachments,
  linkPreviews,
  attachmentsLoading,
  loading,
  error,
  notice,
  onClose,
  onMemberSearchChange,
  onGroupNameDraftChange,
  onAnnouncementDraftChange,
  onSaveGroupName,
  onSaveAnnouncement,
  onAddMember,
  onRemoveMember,
  onCreateInviteLink,
  onCopyInviteLink,
  onRevokeInviteLink,
}: ConversationDetailsProps) {
  if (!open || !conversation) return null;

  const isGroup = conversation.type === 'group';
  const isChannel = conversation.type === 'channel';
  const currentMember = members.find(member => member.userId === currentUser.id);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const existingIds = new Set(members.map(member => member.userId));
  const profileMeta = isChannel
    ? `${conversation.memberCount} subscribers`
    : isGroup
      ? `${conversation.memberCount} members`
      : conversation.user?.email;

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
          <span>{profileMeta}</span>
        </div>

        {isChannel && (
          <div className="details-section">
            <label>Description</label>
            <div className="announcement-card">{conversation.description || 'No description'}</div>
          </div>
        )}

        <div className="details-section">
          <label>Media</label>
          {attachmentsLoading && <div className="state-banner flush">Loading shared files...</div>}
          <div className="media-grid">
            {mediaAttachments.map(attachment => (
              <a className="media-thumb" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id} title={attachment.fileName}>
                {attachment.kind === 'image' ? (
                  <img src={attachment.url} alt={attachment.fileName} />
                ) : (
                  <span>{attachment.kind}</span>
                )}
              </a>
            ))}
          </div>
          {!attachmentsLoading && mediaAttachments.length === 0 && (
            <div className="state-banner flush">No media</div>
          )}
        </div>

        <div className="details-section">
          <label>Files</label>
          <div className="file-list">
            {fileAttachments.map(attachment => (
              <a className="shared-file-row" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id}>
                <FileText size={18} />
                <span>
                  <strong>{attachment.fileName}</strong>
                  <small>{formatFileSize(attachment.size)} · {attachment.message?.sender?.username || attachment.uploader?.username || 'User'}</small>
                </span>
              </a>
            ))}
          </div>
          {!attachmentsLoading && fileAttachments.length === 0 && (
            <div className="state-banner flush">No files</div>
          )}
        </div>

        <div className="details-section">
          <label>Links</label>
          <div className="link-list">
            {linkPreviews.map(link => (
              <a className="shared-link-row" href={link.url} target="_blank" rel="noreferrer" key={link.id}>
                <Link2 size={18} />
                <span>
                  <strong>{link.title}</strong>
                  <small>{link.url}</small>
                  <em>{link.sender?.username || 'User'} · {link.content}</em>
                </span>
              </a>
            ))}
          </div>
          {!attachmentsLoading && linkPreviews.length === 0 && (
            <div className="state-banner flush">No links</div>
          )}
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
          <div className="details-section">
            <label>Announcement</label>
            {canManage ? (
              <>
                <textarea
                  className="details-textarea"
                  value={announcementDraft}
                  onChange={event => onAnnouncementDraftChange(event.target.value)}
                  maxLength={1000}
                  placeholder="Group announcement"
                />
                <button className="solid-button" type="button" onClick={onSaveAnnouncement}>Save</button>
              </>
            ) : (
              <div className="announcement-card">{conversation.announcement || 'No announcement'}</div>
            )}
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

        {isChannel && (
          <div className="details-section">
            <label>Subscribers</label>
            {loading && <div className="state-banner">Loading subscribers...</div>}
            {members.map(member => (
              <div className="member-row" key={member.id}>
                <Avatar name={member.user.username} src={member.user.avatar} status={member.user.status} />
                <span>
                  <strong>{member.user.username}</strong>
                  <small>{member.role}</small>
                </span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="state-banner error">{error}</div>}
        {notice && !error && <div className="state-banner">{notice}</div>}
      </div>
    </aside>
  );
}
