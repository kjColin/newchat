import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { useConversationDetails } from './useConversationDetails';

vi.mock('./api', () => ({
  addGroupMembers: vi.fn(),
  createGroupInviteLink: vi.fn(),
  getChannelMembers: vi.fn(),
  getConversationAttachments: vi.fn(),
  getConversationLinks: vi.fn(),
  getGroupInviteLinks: vi.fn(),
  getGroupMembers: vi.fn(),
  removeGroupMember: vi.fn(),
  revokeGroupInviteLink: vi.fn(),
  updateGroup: vi.fn(),
}));

const mockAddGroupMembers = vi.mocked(addGroupMembers);
const mockCreateGroupInviteLink = vi.mocked(createGroupInviteLink);
const mockGetChannelMembers = vi.mocked(getChannelMembers);
const mockGetConversationAttachments = vi.mocked(getConversationAttachments);
const mockGetConversationLinks = vi.mocked(getConversationLinks);
const mockGetGroupInviteLinks = vi.mocked(getGroupInviteLinks);
const mockGetGroupMembers = vi.mocked(getGroupMembers);
const mockRemoveGroupMember = vi.mocked(removeGroupMember);
const mockRevokeGroupInviteLink = vi.mocked(revokeGroupInviteLink);
const mockUpdateGroup = vi.mocked(updateGroup);

function makeCurrentUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'owner',
    email: 'owner@example.com',
    ...overrides,
  };
}

function makeSearchUser(overrides: Partial<SearchUser> = {}): SearchUser {
  return {
    id: 'user-2',
    username: 'alice',
    email: 'alice@example.com',
    ...overrides,
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    type: 'group',
    name: 'Project Team',
    announcement: 'Initial announcement',
    memberCount: 2,
    ...overrides,
  };
}

function makeMember(overrides: Partial<GroupMember> = {}): GroupMember {
  const user = makeSearchUser({
    id: overrides.userId || 'user-1',
    username: overrides.userId === 'user-2' ? 'alice' : 'owner',
    email: `${overrides.userId || 'user-1'}@example.com`,
  });

  return {
    id: `member-${user.id}`,
    userId: user.id,
    groupId: 'group-1',
    role: user.id === 'user-1' ? 'owner' : 'member',
    joinedAt: '2026-06-13T00:00:00.000Z',
    user,
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    uploaderId: 'user-1',
    kind: 'image',
    fileName: 'photo.png',
    mimeType: 'image/png',
    size: 100,
    url: 'https://example.com/photo.png',
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeLink(overrides: Partial<LinkPreview> = {}): LinkPreview {
  return {
    id: 'link-1',
    url: 'https://example.com',
    title: 'Example',
    hostname: 'example.com',
    messageId: 'message-1',
    conversationId: 'conversation-1',
    content: 'https://example.com',
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'invite-1',
    groupId: 'group-1',
    code: 'invite-code',
    createdById: 'user-1',
    usedCount: 0,
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function renderUseConversationDetails(options: Partial<Parameters<typeof useConversationDetails>[0]> = {}) {
  const callbacks = {
    onConversationPatch: vi.fn(),
    onMemberCountChange: vi.fn(),
  };
  const currentUser = makeCurrentUser();

  return {
    callbacks,
    currentUser,
    ...renderHook(() =>
      useConversationDetails({
        currentUser,
        ...callbacks,
        ...options,
      }),
    ),
  };
}

describe('useConversationDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversationAttachments.mockResolvedValue({ attachments: [], hasMore: false });
    mockGetConversationLinks.mockResolvedValue({ links: [], hasMore: false });
    mockGetGroupMembers.mockResolvedValue([]);
    mockGetChannelMembers.mockResolvedValue([]);
    mockGetGroupInviteLinks.mockResolvedValue([]);
  });

  it('opens group details and loads shared content, members, and invite links for admins', async () => {
    const media = makeAttachment({ id: 'media-1', kind: 'image' });
    const file = makeAttachment({ id: 'file-1', kind: 'file', fileName: 'report.pdf' });
    const link = makeLink();
    const owner = makeMember({ userId: 'user-1', role: 'owner' });
    const member = makeMember({ userId: 'user-2', role: 'member' });
    const invite = makeInvite();
    mockGetConversationAttachments.mockResolvedValue({ attachments: [media, file], hasMore: false });
    mockGetConversationLinks.mockResolvedValue({ links: [link], hasMore: false });
    mockGetGroupMembers.mockResolvedValue([owner, member]);
    mockGetGroupInviteLinks.mockResolvedValue([invite]);

    const { result } = renderUseConversationDetails();
    const conversation = makeConversation();

    await act(async () => {
      await result.current.openDetails(conversation);
    });

    expect(result.current.detailsOpen).toBe(true);
    expect(result.current.groupNameDraft).toBe(conversation.name);
    expect(result.current.announcementDraft).toBe(conversation.announcement);
    expect(result.current.mediaAttachments).toEqual([media]);
    expect(result.current.fileAttachments).toEqual([file]);
    expect(result.current.linkPreviews).toEqual([link]);
    expect(result.current.members).toEqual([owner, member]);
    expect(result.current.inviteLinks).toEqual([invite]);
    expect(result.current.membersLoading).toBe(false);
    expect(result.current.attachmentsLoading).toBe(false);
    expect(result.current.inviteLoading).toBe(false);
    expect(mockGetConversationAttachments).toHaveBeenCalledWith(conversation.id, { limit: 80 });
    expect(mockGetConversationLinks).toHaveBeenCalledWith(conversation.id, { limit: 40, senderId: undefined });
  });

  it('loads channel members and avoids group invite lookups for channels', async () => {
    const channelAdmin = makeMember({
      id: 'channel-member-1',
      userId: 'user-1',
      channelId: 'channel-1',
      groupId: undefined,
      role: 'admin',
    });
    mockGetChannelMembers.mockResolvedValue([channelAdmin]);

    const { result } = renderUseConversationDetails();

    await act(async () => {
      await result.current.openDetails(makeConversation({
        id: 'channel-conversation',
        conversationId: 'channel-conversation',
        type: 'channel',
        name: 'Announcements',
      }));
    });

    expect(result.current.members).toEqual([channelAdmin]);
    expect(mockGetChannelMembers).toHaveBeenCalledWith('channel-conversation');
    expect(mockGetGroupMembers).not.toHaveBeenCalled();
    expect(mockGetGroupInviteLinks).not.toHaveBeenCalled();
    expect(result.current.inviteLinks).toEqual([]);
  });

  it('changes link filters for direct conversations', async () => {
    const contactLink = makeLink({ id: 'contact-link' });
    const myLink = makeLink({ id: 'my-link' });
    const directConversation = makeConversation({
      type: 'direct',
      user: makeSearchUser({ id: 'contact-1' }),
    });
    mockGetConversationLinks
      .mockResolvedValueOnce({ links: [], hasMore: false })
      .mockResolvedValueOnce({ links: [contactLink], hasMore: false })
      .mockResolvedValueOnce({ links: [myLink], hasMore: false });

    const { result, currentUser } = renderUseConversationDetails();

    await act(async () => {
      await result.current.openDetails(directConversation);
      await result.current.changeLinkFilter(directConversation, 'contact');
    });

    expect(result.current.linkFilter).toBe('contact');
    expect(result.current.linkPreviews).toEqual([contactLink]);
    expect(mockGetConversationLinks).toHaveBeenLastCalledWith(directConversation.id, {
      limit: 40,
      senderId: 'contact-1',
    });

    await act(async () => {
      await result.current.changeLinkFilter(directConversation, 'me');
    });

    expect(result.current.linkFilter).toBe('me');
    expect(result.current.linkPreviews).toEqual([myLink]);
    expect(mockGetConversationLinks).toHaveBeenLastCalledWith(directConversation.id, {
      limit: 40,
      senderId: currentUser.id,
    });
  });

  it('creates, copies, and revokes invite links', async () => {
    const invite = makeInvite({ id: 'invite-new', code: 'new-code' });
    const revoked = makeInvite({ id: 'invite-new', code: 'new-code', revokedAt: '2026-06-13T00:05:00.000Z' });
    mockCreateGroupInviteLink.mockResolvedValue(invite);
    mockRevokeGroupInviteLink.mockResolvedValue(revoked);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderUseConversationDetails();
    const conversation = makeConversation();

    await act(async () => {
      await result.current.createInviteLink(conversation);
    });

    expect(result.current.inviteLinks).toEqual([invite]);
    expect(mockCreateGroupInviteLink).toHaveBeenCalledWith(conversation.id);

    await act(async () => {
      await result.current.copyInviteLink(invite);
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/chat?invite=${invite.code}`);
    expect(result.current.detailsNotice).toBe('Invite link copied');

    await act(async () => {
      await result.current.revokeInviteLink(conversation, invite.id);
    });

    expect(result.current.inviteLinks).toEqual([revoked]);
    expect(mockRevokeGroupInviteLink).toHaveBeenCalledWith(conversation.id, invite.id);
  });

  it('saves group profile fields and member changes', async () => {
    const updatedName = makeConversation({ id: 'conversation-1', name: 'Renamed Team' });
    const updatedAnnouncement = makeConversation({
      id: 'conversation-1',
      announcement: 'Updated announcement',
    });
    const addedMembers = [
      makeMember({ userId: 'user-1', role: 'owner' }),
      makeMember({ userId: 'user-2', role: 'member' }),
      makeMember({ userId: 'user-3', role: 'member' }),
    ];
    const removedMembers = addedMembers.slice(0, 2);
    mockUpdateGroup
      .mockResolvedValueOnce(updatedName)
      .mockResolvedValueOnce(updatedAnnouncement);
    mockAddGroupMembers.mockResolvedValue(addedMembers);
    mockRemoveGroupMember.mockResolvedValue(removedMembers);

    const { result, callbacks } = renderUseConversationDetails();
    const conversation = makeConversation();

    act(() => {
      result.current.setGroupNameDraft('  Renamed Team  ');
      result.current.setAnnouncementDraft('Updated announcement');
      result.current.setMemberSearch('ali');
      result.current.setMemberSearchResults([makeSearchUser({ id: 'user-2' })]);
    });

    await act(async () => {
      await result.current.saveGroupName(conversation);
      await result.current.saveAnnouncement(conversation);
      await result.current.addMember(conversation, makeSearchUser({ id: 'user-3' }));
      await result.current.removeMember(conversation, 'user-3');
    });

    expect(mockUpdateGroup).toHaveBeenNthCalledWith(1, conversation.id, { name: 'Renamed Team' });
    expect(mockUpdateGroup).toHaveBeenNthCalledWith(2, conversation.id, { announcement: 'Updated announcement' });
    expect(callbacks.onConversationPatch).toHaveBeenCalledWith(updatedName.id, updatedName);
    expect(callbacks.onConversationPatch).toHaveBeenCalledWith(updatedAnnouncement.id, updatedAnnouncement);
    expect(result.current.detailsNotice).toBe('Announcement saved');
    expect(result.current.memberSearch).toBe('');
    expect(result.current.memberSearchResults).toEqual([]);
    expect(result.current.members).toEqual(removedMembers);
    expect(callbacks.onMemberCountChange).toHaveBeenCalledWith(conversation.id, addedMembers.length);
    expect(callbacks.onMemberCountChange).toHaveBeenCalledWith(conversation.id, removedMembers.length);
  });

  it('updates member profiles locally and resets detail state', async () => {
    const member = makeMember({ userId: 'user-2' });
    mockGetGroupMembers.mockResolvedValue([makeMember({ userId: 'user-1', role: 'owner' }), member]);

    const { result } = renderUseConversationDetails();

    await act(async () => {
      await result.current.openDetails(makeConversation());
    });

    act(() => {
      result.current.applyProfileUpdate({
        id: 'user-2',
        username: 'alice-updated',
        email: 'alice@example.com',
        avatar: 'https://example.com/avatar.png',
      });
    });

    expect(result.current.members.find(item => item.userId === 'user-2')?.user).toMatchObject({
      username: 'alice-updated',
      avatar: 'https://example.com/avatar.png',
    });

    act(() => {
      result.current.closeDetails();
    });

    expect(result.current.detailsOpen).toBe(false);

    act(() => {
      result.current.resetDetails();
    });

    expect(result.current.members).toEqual([]);
    expect(result.current.mediaAttachments).toEqual([]);
    expect(result.current.fileAttachments).toEqual([]);
    expect(result.current.linkPreviews).toEqual([]);
    expect(result.current.linkFilter).toBe('all');
    expect(result.current.inviteLinks).toEqual([]);
  });

  it('surfaces load and mutation errors', async () => {
    mockGetConversationAttachments.mockRejectedValue({
      response: { data: { message: 'Shared content failed' } },
    });
    mockGetGroupMembers.mockRejectedValue({
      response: { data: { message: 'Members failed' } },
    });
    mockUpdateGroup.mockRejectedValue({
      response: { data: { message: 'Group update failed' } },
    });

    const { result } = renderUseConversationDetails();
    const conversation = makeConversation();

    await act(async () => {
      await result.current.openDetails(conversation);
    });

    expect(result.current.detailsError).toBe('Members failed');
    expect(result.current.attachmentsLoading).toBe(false);
    expect(result.current.membersLoading).toBe(false);

    await act(async () => {
      await result.current.saveGroupName(conversation);
    });

    expect(result.current.detailsError).toBe('Group update failed');
  });
});
