import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef, type ComponentProps } from 'react';
import type { User } from '../../auth/types';
import type { Attachment, Message } from '../types';
import { MessageList } from './MessageList';

const currentUser: User = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
};

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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    content: 'Hello',
    type: 'text',
    senderId: 'user-1',
    conversationId: 'conversation-1',
    createdAt: '2026-06-13T08:00:00.000Z',
    sender: {
      id: 'user-1',
      username: 'alice',
    },
    ...overrides,
  };
}

function renderMessageList(overrides: Partial<ComponentProps<typeof MessageList>> = {}) {
  const props: ComponentProps<typeof MessageList> = {
    currentUser,
    messages: [],
    loading: false,
    loadingEarlier: false,
    hasMore: false,
    error: '',
    unreadMarkerId: null,
    listRef: createRef<HTMLDivElement>(),
    bottomRef: createRef<HTMLDivElement>(),
    pinnedMessageIds: new Set(),
    onLoadEarlier: vi.fn(),
    onScroll: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onReact: vi.fn(),
    onReply: vi.fn(),
    onForward: vi.fn(),
    onTogglePin: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<MessageList {...props} />),
  };
}

describe('MessageList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders loading, error, and empty states', () => {
    const loading = renderMessageList({ loading: true });
    expect(screen.getByText('Loading messages...')).toBeTruthy();
    loading.unmount();

    const error = renderMessageList({ error: 'Could not load messages' });
    expect(screen.getByText('Could not load messages')).toBeTruthy();
    error.unmount();

    renderMessageList();
    expect(screen.getByText('No messages yet')).toBeTruthy();
  });

  it('loads earlier messages and reports scrolling', () => {
    const message = makeMessage();
    const { props } = renderMessageList({
      messages: [message],
      hasMore: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }));
    fireEvent.scroll(document.querySelector('.message-list') as HTMLElement);

    expect(props.onLoadEarlier).toHaveBeenCalledTimes(1);
    expect(props.onScroll).toHaveBeenCalledTimes(1);
  });

  it('renders message metadata and calls toolbar actions', () => {
    const ownMessage = makeMessage({
      id: 'own-message',
      content: 'Ship it',
      replyTo: {
        id: 'reply-1',
        content: 'Earlier note',
        senderId: 'user-2',
        sender: {
          id: 'user-2',
          username: 'bob',
        },
      },
      forwardFrom: {
        id: 'forward-1',
        content: 'Forwarded note',
        senderId: 'user-3',
        sender: {
          id: 'user-3',
          username: 'carol',
        },
      },
      attachments: [makeAttachment()],
      reactions: [
        {
          id: 'reaction-1',
          emoji: '👍',
          userId: currentUser.id,
          messageId: 'own-message',
          createdAt: '2026-06-13T08:00:00.000Z',
        },
        {
          id: 'reaction-2',
          emoji: '👍',
          userId: 'user-2',
          messageId: 'own-message',
          createdAt: '2026-06-13T08:01:00.000Z',
        },
      ],
    });
    const otherMessage = makeMessage({
      id: 'other-message',
      content: 'From Bob',
      senderId: 'user-2',
      sender: {
        id: 'user-2',
        username: 'bob',
      },
    });
    const { props } = renderMessageList({
      messages: [ownMessage, otherMessage],
      unreadMarkerId: 'own-message',
      pinnedMessageIds: new Set(['own-message']),
    });
    const row = document.getElementById('message-own-message') as HTMLElement;

    expect(screen.getByText('Unread messages')).toBeTruthy();
    expect(within(row).getByText('Ship it')).toBeTruthy();
    expect(within(row).getByText('Earlier note')).toBeTruthy();
    expect(within(row).getByText('Forwarded from carol')).toBeTruthy();
    expect(within(row).getByText('brief.pdf')).toBeTruthy();
    expect(within(document.getElementById('message-other-message') as HTMLElement).getByText('bob')).toBeTruthy();

    fireEvent.click(within(row).getAllByRole('button', { name: '👍' })[0]);
    fireEvent.click(within(row).getByRole('button', { name: '👍 2' }));
    fireEvent.click(within(row).getByTitle('Reply'));
    fireEvent.click(within(row).getByTitle('Forward'));
    fireEvent.click(within(row).getByTitle('Unpin'));
    fireEvent.click(within(row).getByTitle('Edit'));
    fireEvent.click(within(row).getByTitle('Delete'));

    expect(props.onReact).toHaveBeenNthCalledWith(1, ownMessage, '👍');
    expect(props.onReact).toHaveBeenNthCalledWith(2, ownMessage, '👍');
    expect(props.onReply).toHaveBeenCalledWith(ownMessage);
    expect(props.onForward).toHaveBeenCalledWith(ownMessage);
    expect(props.onTogglePin).toHaveBeenCalledWith(ownMessage);
    expect(props.onEdit).toHaveBeenCalledWith(ownMessage);
    expect(props.onDelete).toHaveBeenCalledWith(ownMessage);
  });

  it('hides message actions for deleted messages', () => {
    renderMessageList({
      messages: [
        makeMessage({
          id: 'deleted-message',
          content: 'Secret',
          deletedAt: '2026-06-13T08:05:00.000Z',
          attachments: [makeAttachment()],
        }),
      ],
    });
    const row = document.getElementById('message-deleted-message') as HTMLElement;

    expect(within(row).getByText('Message deleted')).toBeTruthy();
    expect(row.querySelector('.message-toolbar')).toBeNull();
    expect(row.querySelector('.message-attachments')).toBeNull();
  });
});
