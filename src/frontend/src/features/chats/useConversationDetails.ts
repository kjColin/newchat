import { useCallback, useState } from 'react';
import type { User } from '../auth/types';
import type { SearchUser } from '../users/types';
import {
  addGroupMembers,
  createGroupInviteLink,
  getChannelMembers,
  getConversationAttachments,
  getConversationLinks,
  getGroupInviteLinks,
  getGroupMembers,
  removeGroupMember,
  revokeGroupInviteLink,
  updateGroup,
} from './api';
import type { Attachment, Conversation, GroupMember, InviteLink, LinkPreview } from './types';

type LinkFilter = 'all' | 'contact' | 'me';

type UseConversationDetailsOptions = {
  currentUser: User;
  onConversationPatch: (conversationId: string, updates: Partial<Conversation>) => void;
  onMemberCountChange: (conversationId: string, memberCount: number) => void;
};

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export function useConversationDetails({
  currentUser,
  onConversationPatch,
  onMemberCountChange,
}: UseConversationDetailsOptions) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsNotice, setDetailsNotice] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<Attachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<Attachment[]>([]);
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<SearchUser[]>([]);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
  }, []);

  const resetDetails = useCallback(() => {
    setDetailsOpen(false);
    setMembers([]);
    setDetailsError('');
    setDetailsNotice('');
    setMediaAttachments([]);
    setFileAttachments([]);
    setLinkPreviews([]);
    setLinkFilter('all');
    setMemberSearch('');
    setMemberSearchResults([]);
    setInviteLinks([]);
    setInviteLoading(false);
    setMembersLoading(false);
    setAttachmentsLoading(false);
  }, []);

  const loadConversationLinks = useCallback(async (conversation: Conversation, filter: LinkFilter) => {
    const senderId = conversation.type !== 'direct' || filter === 'all'
      ? undefined
      : filter === 'me'
        ? currentUser.id
        : conversation.user?.id;

    const linksData = await getConversationLinks(conversation.id, {
      limit: 40,
      senderId,
    });
    setLinkPreviews(linksData.links);
  }, [currentUser.id]);

  const openDetails = useCallback(async (conversation: Conversation | null) => {
    if (!conversation) return;
    setDetailsOpen(true);
    setDetailsError('');
    setDetailsNotice('');
    setInviteLinks([]);
    setMembers([]);
    setMediaAttachments([]);
    setFileAttachments([]);
    setLinkPreviews([]);
    setLinkFilter('all');
    setGroupNameDraft(conversation.name);
    setAnnouncementDraft(conversation.announcement || '');
    setMemberSearch('');
    setMemberSearchResults([]);

    setAttachmentsLoading(true);
    try {
      const attachmentsPromise = getConversationAttachments(conversation.id, { limit: 80 });
      const linksPromise = loadConversationLinks(conversation, 'all');
      const attachmentsData = await attachmentsPromise;
      await linksPromise;
      setMediaAttachments(attachmentsData.attachments.filter(attachment => attachment.kind !== 'file'));
      setFileAttachments(attachmentsData.attachments.filter(attachment => attachment.kind === 'file'));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load shared content');
    } finally {
      setAttachmentsLoading(false);
    }

    setMembersLoading(true);
    setInviteLoading(true);
    try {
      const nextMembers = conversation.type === 'channel'
        ? await getChannelMembers(conversation.id)
        : conversation.type === 'group'
          ? await getGroupMembers(conversation.id)
          : [];
      setMembers(nextMembers);
      const currentMember = nextMembers.find(member => member.userId === currentUser.id);
      if (conversation.type === 'group' && (currentMember?.role === 'owner' || currentMember?.role === 'admin')) {
        setInviteLinks(await getGroupInviteLinks(conversation.id));
      } else {
        setInviteLinks([]);
      }
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load members');
    } finally {
      setMembersLoading(false);
      setInviteLoading(false);
    }
  }, [currentUser.id, loadConversationLinks]);

  const changeLinkFilter = useCallback(async (conversation: Conversation | null, filter: LinkFilter) => {
    if (!conversation) return;
    setLinkFilter(filter);
    setAttachmentsLoading(true);
    setDetailsError('');
    try {
      await loadConversationLinks(conversation, filter);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load links');
    } finally {
      setAttachmentsLoading(false);
    }
  }, [loadConversationLinks]);

  const createInviteLink = useCallback(async (conversation: Conversation | null) => {
    if (!conversation) return;
    setInviteLoading(true);
    setDetailsError('');
    setDetailsNotice('');
    try {
      const invite = await createGroupInviteLink(conversation.id);
      setInviteLinks(prev => [invite, ...prev]);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not create invite link');
    } finally {
      setInviteLoading(false);
    }
  }, []);

  const copyInviteLink = useCallback(async (invite: InviteLink) => {
    setDetailsError('');
    setDetailsNotice('');
    try {
      await copyTextToClipboard(`${window.location.origin}/chat?invite=${invite.code}`);
      setDetailsNotice('Invite link copied');
    } catch {
      setDetailsError('Could not copy invite link');
    }
  }, []);

  const revokeInviteLink = useCallback(async (conversation: Conversation | null, inviteId: string) => {
    if (!conversation) return;
    setInviteLoading(true);
    setDetailsError('');
    setDetailsNotice('');
    try {
      const revoked = await revokeGroupInviteLink(conversation.id, inviteId);
      setInviteLinks(prev => prev.map(invite => invite.id === revoked.id ? revoked : invite));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not revoke invite link');
    } finally {
      setInviteLoading(false);
    }
  }, []);

  const saveGroupName = useCallback(async (conversation: Conversation | null) => {
    if (!conversation || conversation.type !== 'group') return;
    try {
      const updated = await updateGroup(conversation.id, { name: groupNameDraft.trim() });
      onConversationPatch(updated.id, updated);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not update group');
    }
  }, [groupNameDraft, onConversationPatch]);

  const saveAnnouncement = useCallback(async (conversation: Conversation | null) => {
    if (!conversation || conversation.type !== 'group') return;
    try {
      const updated = await updateGroup(conversation.id, { announcement: announcementDraft });
      onConversationPatch(updated.id, updated);
      setDetailsNotice('Announcement saved');
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not update announcement');
    }
  }, [announcementDraft, onConversationPatch]);

  const addMember = useCallback(async (conversation: Conversation | null, user: SearchUser) => {
    if (!conversation) return;
    try {
      const nextMembers = await addGroupMembers(conversation.id, [user.id]);
      setMembers(nextMembers);
      setMemberSearch('');
      setMemberSearchResults([]);
      onMemberCountChange(conversation.id, nextMembers.length);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not add member');
    }
  }, [onMemberCountChange]);

  const removeMember = useCallback(async (conversation: Conversation | null, userId: string) => {
    if (!conversation) return;
    try {
      const nextMembers = await removeGroupMember(conversation.id, userId);
      setMembers(nextMembers);
      onMemberCountChange(conversation.id, nextMembers.length);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not remove member');
    }
  }, [onMemberCountChange]);

  const applyProfileUpdate = useCallback((user: User) => {
    setMembers(prev => prev.map(member =>
      member.userId === user.id ? { ...member, user: { ...member.user, ...user } } : member
    ));
  }, []);

  return {
    detailsOpen,
    members,
    membersLoading,
    detailsError,
    detailsNotice,
    mediaAttachments,
    fileAttachments,
    linkPreviews,
    linkFilter,
    attachmentsLoading,
    memberSearch,
    memberSearchResults,
    groupNameDraft,
    announcementDraft,
    inviteLinks,
    inviteLoading,
    setMemberSearch,
    setMemberSearchResults,
    setGroupNameDraft,
    setAnnouncementDraft,
    openDetails,
    closeDetails,
    resetDetails,
    changeLinkFilter,
    createInviteLink,
    copyInviteLink,
    revokeInviteLink,
    saveGroupName,
    saveAnnouncement,
    addMember,
    removeMember,
    applyProfileUpdate,
  };
}
