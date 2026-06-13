import { useCallback, useState } from 'react';
import { createChannel, createGroup } from './api';
import type { Conversation } from './types';
import type { SearchUser } from '../users/types';

type UseCreateConversationOptions = {
  onConversationCreated: (conversation: Conversation) => Promise<void>;
  onClearGroupSearch: () => void;
};

export function useCreateConversation({
  onConversationCreated,
  onClearGroupSearch,
}: UseCreateConversationOptions) {
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [createError, setCreateError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelError, setChannelError] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

  const openCreateGroup = useCallback(() => {
    setCreateGroupOpen(true);
  }, []);

  const closeCreateGroup = useCallback(() => {
    setCreateGroupOpen(false);
  }, []);

  const openCreateChannel = useCallback(() => {
    setCreateChannelOpen(true);
  }, []);

  const closeCreateChannel = useCallback(() => {
    setCreateChannelOpen(false);
  }, []);

  const toggleMember = useCallback((user: SearchUser) => {
    setSelectedMembers(prev =>
      prev.some(member => member.id === user.id)
        ? prev.filter(member => member.id !== user.id)
        : [...prev, user]
    );
  }, []);

  const submitGroup = useCallback(async () => {
    setCreatingGroup(true);
    setCreateError('');
    try {
      const conversation = await createGroup(groupName.trim(), selectedMembers.map(member => member.id));
      setCreateGroupOpen(false);
      setGroupName('');
      onClearGroupSearch();
      setSelectedMembers([]);
      await onConversationCreated(conversation);
    } catch (error: any) {
      setCreateError(error.response?.data?.message || 'Could not create group');
    } finally {
      setCreatingGroup(false);
    }
  }, [groupName, onClearGroupSearch, onConversationCreated, selectedMembers]);

  const submitChannel = useCallback(async () => {
    setCreatingChannel(true);
    setChannelError('');
    try {
      const conversation = await createChannel(channelName.trim(), channelDescription.trim());
      setCreateChannelOpen(false);
      setChannelName('');
      setChannelDescription('');
      await onConversationCreated(conversation);
    } catch (error: any) {
      setChannelError(error.response?.data?.message || 'Could not create channel');
    } finally {
      setCreatingChannel(false);
    }
  }, [channelDescription, channelName, onConversationCreated]);

  return {
    createGroupOpen,
    createChannelOpen,
    groupName,
    selectedMembers,
    createError,
    creatingGroup,
    channelName,
    channelDescription,
    channelError,
    creatingChannel,
    setGroupName,
    setChannelName,
    setChannelDescription,
    openCreateGroup,
    closeCreateGroup,
    openCreateChannel,
    closeCreateChannel,
    toggleMember,
    submitGroup,
    submitChannel,
  };
}
