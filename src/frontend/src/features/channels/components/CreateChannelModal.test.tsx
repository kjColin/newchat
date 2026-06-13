import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { CreateChannelModal } from './CreateChannelModal';

function renderCreateChannelModal(overrides: Partial<ComponentProps<typeof CreateChannelModal>> = {}) {
  const props: ComponentProps<typeof CreateChannelModal> = {
    open: true,
    name: '',
    description: '',
    submitting: false,
    error: '',
    onNameChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<CreateChannelModal {...props} />),
  };
}

describe('CreateChannelModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render when closed', () => {
    renderCreateChannelModal({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('emits name and description changes', () => {
    const { props } = renderCreateChannelModal();

    fireEvent.change(screen.getByPlaceholderText('Channel name'), {
      target: { value: 'Announcements' },
    });
    fireEvent.change(screen.getByPlaceholderText('Description'), {
      target: { value: 'Product updates' },
    });

    expect(props.onNameChange).toHaveBeenCalledWith('Announcements');
    expect(props.onDescriptionChange).toHaveBeenCalledWith('Product updates');
  });

  it('shows errors and disables submit while invalid or submitting', () => {
    const invalid = renderCreateChannelModal({
      name: '   ',
      error: 'Could not create channel',
    });

    expect(screen.getByText('Could not create channel')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true);
    invalid.unmount();

    renderCreateChannelModal({ name: 'Announcements', submitting: true });

    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true);
  });

  it('submits with a valid name and closes from controls or backdrop', () => {
    const { props } = renderCreateChannelModal({ name: 'Announcements' });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.mouseDown(screen.getByRole('presentation'));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});
