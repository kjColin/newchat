import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { User } from '../../auth/types';
import type { SearchUser } from '../../users/types';
import type { Attachment, Conversation, GroupMember, InviteLink, LinkPreview } from '../types';
import { ConversationDetails } from './ConversationDetails';

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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    groupId: 'group-1',
    type: 'group',
    name: 'Project Team',
    memberCount: 2,
    announcement: 'Welcome',
    lastActivityAt: '2026-06-13T08:00:00.000Z',
    ...overrides,
  };
}

function makeMember(user: SearchUser, role: GroupMember['role'] = 'member'): GroupMember {
  return {
    id: `member-${user.id}`,
    userId: user.id,
    groupId: 'group-1',
    role,
    joinedAt: '2026-06-13T08:00:00.000Z',
    user,
  };
}

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    messageId: 'message-1',
    uploaderId: 'user-1',
    kind: 'file',
    fileName: 'brief.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    url: '/uploads/brief.pdf',
    createdAt: '2026-06-13T08:00:00.000Z',
    ...overrides,
  };
}

function makeLink(overrides: Partial<LinkPreview> = {}): LinkPreview {
  return {
    id: 'link-1',
    url: 'https://example.com/post',
    title: 'Launch notes',
    hostname: 'example.com',
    messageId: 'message-1',
    conversationId: 'conversation-1',
    content: 'See this link',
    createdAt: '2026-06-13T08:00:00.000Z',
    sender: {
      id: 'user-2',
      username: 'bob',
    },
    ...overrides,
  };
}

function makeInvite(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'invite-1',
    groupId: 'group-1',
    code: 'invite-abc',
    createdById: 'user-1',
    expiresAt: '2999-01-01T00:00:00.000Z',
    maxUses: null,
    usedCount: 0,
    revokedAt: null,
    createdAt: '2026-06-13T08:00:00.000Z',
    ...overrides,
  };
}

function renderConversationDetails(overrides: Partial<ComponentProps<typeof ConversationDetails>> = {}) {
  const props: ComponentProps<typeof ConversationDetails> = {
    open: true,
    currentUser: makeUser(),
    conversation: makeConversation(),
    members: [makeMember(makeSearchUser({ id: 'user-1', username: 'alice', email: 'alice@example.com' }), 'owner')],
    memberSearch: '',
    memberSearchResults: [],
    groupNameDraft: 'Project Team',
    announcementDraft: 'Welcome',
    inviteLinks: [],
    inviteLinkBaseUrl: 'https://newchat.test/invite/',
    inviteLoading: false,
    mediaAttachments: [],
    fileAttachments: [],
    linkPreviews: [],
    linkFilter: 'all',
    attachmentsLoading: false,
    loading: false,
    error: '',
    notice: '',
    onClose: vi.fn(),
    onMemberSearchChange: vi.fn(),
    onGroupNameDraftChange: vi.fn(),
    onAnnouncementDraftChange: vi.fn(),
    onLinkFilterChange: vi.fn(),
    onSaveGroupName: vi.fn(),
    onSaveAnnouncement: vi.fn(),
    onAddMember: vi.fn(),
    onRemoveMember: vi.fn(),
    onCreateInviteLink: vi.fn(),
    onCopyInviteLink: vi.fn(),
    onRevokeInviteLink: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<ConversationDetails {...props} />),
  };
}

describe('ConversationDetails', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render when closed or without a conversation', () => {
    renderConversationDetails({ open: false });
    expect(screen.queryByText('Details')).toBeNull();
    cleanup();

    renderConversationDetails({ conversation: null });
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('renders direct shared content and emits link filter and close actions', () => {
    const bob = makeSearchUser();
    const { props } = renderConversationDetails({
      conversation: makeConversation({
        type: 'direct',
        groupId: undefined,
        name: 'bob',
        user: bob,
        memberCount: 2,
      }),
      mediaAttachments: [makeAttachment({ id: 'image-1', kind: 'image', fileName: 'photo.png', url: '/uploads/photo.png' })],
      fileAttachments: [makeAttachment()],
      linkPreviews: [makeLink()],
    });

    expect(screen.getByText('bob@example.com')).toBeTruthy();
    expect(screen.getByTitle('photo.png')).toBeTruthy();
    expect(screen.getByText('brief.pdf')).toBeTruthy();
    expect(screen.getByText('Launch notes')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Contact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Me' }));
    fireEvent.click(screen.getByLabelText('Close details'));

    expect(props.onLinkFilterChange).toHaveBeenNthCalledWith(1, 'contact');
    expect(props.onLinkFilterChange).toHaveBeenNthCalledWith(2, 'me');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('emits group management, member, and invite actions for admins', () => {
    const alice = makeSearchUser({ id: 'user-1', username: 'alice', email: 'alice@example.com' });
    const bob = makeSearchUser();
    const charlie = makeSearchUser({ id: 'user-3', username: 'charlie', email: 'charlie@example.com' });
    const invite = makeInvite();
    const { props } = renderConversationDetails({
      members: [makeMember(alice, 'owner'), makeMember(bob)],
      memberSearchResults: [bob, charlie],
      inviteLinks: [invite],
    });

    fireEvent.change(screen.getByDisplayValue('Project Team'), { target: { value: 'New Team' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Group announcement'), { target: { value: 'New announcement' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[1]);
    fireEvent.change(screen.getByPlaceholderText('Search users'), { target: { value: 'charlie' } });
    fireEvent.click(screen.getByText('charlie@example.com').closest('button') as HTMLElement);
    fireEvent.click(within(screen.getByText('bob').closest('.member-row') as HTMLElement).getByTitle('Remove member'));
    fireEvent.click(screen.getByTitle('Create invite link'));
    fireEvent.click(screen.getByTitle('Copy invite link'));
    fireEvent.click(screen.getByTitle('Revoke invite link'));

    expect(screen.queryByText('bob@example.com')).toBeNull();
    expect(props.onGroupNameDraftChange).toHaveBeenCalledWith('New Team');
    expect(props.onSaveGroupName).toHaveBeenCalledTimes(1);
    expect(props.onAnnouncementDraftChange).toHaveBeenCalledWith('New announcement');
    expect(props.onSaveAnnouncement).toHaveBeenCalledTimes(1);
    expect(props.onMemberSearchChange).toHaveBeenCalledWith('charlie');
    expect(props.onAddMember).toHaveBeenCalledWith(charlie);
    expect(props.onRemoveMember).toHaveBeenCalledWith(bob.id);
    expect(props.onCreateInviteLink).toHaveBeenCalledTimes(1);
    expect(props.onCopyInviteLink).toHaveBeenCalledWith(invite);
    expect(props.onRevokeInviteLink).toHaveBeenCalledWith(invite.id);
  });

  it('renders channel description and subscribers without group admin controls', () => {
    renderConversationDetails({
      conversation: makeConversation({
        type: 'channel',
        groupId: undefined,
        channelId: 'channel-1',
        name: 'Announcements',
        description: 'Product updates',
        memberCount: 4,
      }),
      members: [makeMember(makeSearchUser(), 'subscriber')],
      loading: true,
    });

    expect(screen.getByText('Product updates')).toBeTruthy();
    expect(screen.getByText('Subscribers')).toBeTruthy();
    expect(screen.getByText('Loading subscribers...')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Group announcement')).toBeNull();
  });
});
