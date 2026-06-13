import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { SearchUser } from '../../users/types';
import { CreateGroupModal } from './CreateGroupModal';

function makeUser(overrides: Partial<SearchUser> = {}): SearchUser {
  return {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    status: 'offline',
    ...overrides,
  };
}

function renderCreateGroupModal(overrides: Partial<ComponentProps<typeof CreateGroupModal>> = {}) {
  const props: ComponentProps<typeof CreateGroupModal> = {
    open: true,
    name: '',
    query: '',
    users: [],
    selectedUsers: [],
    submitting: false,
    error: '',
    onNameChange: vi.fn(),
    onQueryChange: vi.fn(),
    onToggleUser: vi.fn(),
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  return {
    props,
    ...render(<CreateGroupModal {...props} />),
  };
}

describe('CreateGroupModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render when closed', () => {
    renderCreateGroupModal({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('emits name and search query changes', () => {
    const { props } = renderCreateGroupModal();

    fireEvent.change(screen.getByPlaceholderText('Group name'), {
      target: { value: 'Project Team' },
    });
    fireEvent.change(screen.getByPlaceholderText('Search people'), {
      target: { value: 'alice' },
    });

    expect(props.onNameChange).toHaveBeenCalledWith('Project Team');
    expect(props.onQueryChange).toHaveBeenCalledWith('alice');
  });

  it('shows users, selected chips, errors, and toggles users', () => {
    const alice = makeUser();
    const bob = makeUser({
      id: 'user-2',
      username: 'bob',
      email: 'bob@example.com',
      status: 'online',
    });
    const { props } = renderCreateGroupModal({
      name: 'Project Team',
      query: 'a',
      users: [alice, bob],
      selectedUsers: [alice],
      error: 'Could not create group',
    });

    const list = document.querySelector('.modal-user-list');
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getByText('alice')).toBeTruthy();
    expect(within(list as HTMLElement).getByText('bob')).toBeTruthy();
    expect(screen.getByText('Could not create group')).toBeTruthy();

    fireEvent.click(within(list as HTMLElement).getByText('alice'));
    fireEvent.click(document.querySelector('.selected-users button') as HTMLElement);

    expect(props.onToggleUser).toHaveBeenCalledWith(alice);
    expect(props.onToggleUser).toHaveBeenCalledTimes(2);
  });

  it('submits only when a non-empty name is present', () => {
    const disabled = renderCreateGroupModal({ name: '   ' });

    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true);
    disabled.unmount();

    const { props } = renderCreateGroupModal({ name: 'Project Team' });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('closes from explicit close controls and backdrop clicks', () => {
    const { props } = renderCreateGroupModal();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.mouseDown(screen.getByRole('presentation'));

    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});
