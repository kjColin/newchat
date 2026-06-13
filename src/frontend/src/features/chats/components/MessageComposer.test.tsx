import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { Attachment, Message } from '../types';
import { MessageComposer } from './MessageComposer';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    content: 'Original message',
    type: 'text',
    senderId: 'user-2',
    conversationId: 'conversation-1',
    createdAt: '2026-06-13T08:00:00.000Z',
    sender: {
      id: 'user-2',
      username: 'bob',
    },
    ...overrides,
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

function renderMessageComposer(overrides: Partial<ComponentProps<typeof MessageComposer>> = {}) {
  const props: ComponentProps<typeof MessageComposer> = {
    value: '',
    disabled: false,
    sending: false,
    editing: false,
    replyTo: null,
    attachments: [],
    onChange: vi.fn(),
    onSend: vi.fn(),
    onCancelEdit: vi.fn(),
    onCancelReply: vi.fn(),
    onSelectFiles: vi.fn(),
    onRemoveAttachment: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<MessageComposer {...props} />),
  };
}

describe('MessageComposer', () => {
  afterEach(() => {
    cleanup();
  });

  it('emits text changes and send actions from the button and Enter key', () => {
    const { props } = renderMessageComposer({ value: 'Hello' });
    const input = screen.getByPlaceholderText('Message');

    fireEvent.change(input, { target: { value: 'Hello world' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(props.onChange).toHaveBeenCalledWith('Hello world');
    expect(props.onSend).toHaveBeenCalledTimes(2);
  });

  it('disables sending empty content and supports editing cancellation', () => {
    const empty = renderMessageComposer();

    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true);
    empty.unmount();

    const { props } = renderMessageComposer({ value: 'Updated copy', editing: true });

    expect(screen.getByPlaceholderText('Edit message')).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(props.onCancelEdit).toHaveBeenCalledTimes(1);
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('renders reply and attachment controls', () => {
    const attachment = makeAttachment();
    const { props } = renderMessageComposer({
      replyTo: makeMessage(),
      attachments: [attachment],
    });

    expect(screen.getByText(/Replying to/)).toBeTruthy();
    expect(screen.getByText(/File: brief.pdf/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Cancel reply'));
    fireEvent.click(screen.getByLabelText('Remove attachment'));

    expect(props.onCancelReply).toHaveBeenCalledTimes(1);
    expect(props.onRemoveAttachment).toHaveBeenCalledWith(attachment.id);
  });

  it('passes selected files to the caller and resets the file input', () => {
    const { props } = renderMessageComposer();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(props.onSelectFiles).toHaveBeenCalledTimes(1);
    expect(props.onSelectFiles).toHaveBeenCalledWith(expect.objectContaining({ 0: file }));
    expect(input.value).toBe('');
  });
});
