import { useCallback, useEffect, useState } from 'react';
import { discoverChannels, discoverGroups } from '../chats/api';
import type { ChannelDiscoveryItem, GroupDiscoveryItem } from '../chats/types';
import { searchUsers } from './api';
import type { SearchUser } from './types';

export function useUserSearch() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [groupResults, setGroupResults] = useState<GroupDiscoveryItem[]>([]);
  const [channelResults, setChannelResults] = useState<ChannelDiscoveryItem[]>([]);
  const [discoveryActionLoading, setDiscoveryActionLoading] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<SearchUser[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<SearchUser[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const query = search.trim();
        if (!query) {
          setSearchResults([]);
          setGroupResults([]);
          setChannelResults([]);
          return;
        }

        const [nextUsers, nextGroups, nextChannels] = await Promise.all([
          searchUsers(query),
          discoverGroups(query),
          discoverChannels(query),
        ]);
        setSearchResults(nextUsers);
        setGroupResults(nextGroups);
        setChannelResults(nextChannels);
      } catch {
        setSearchResults([]);
        setGroupResults([]);
        setChannelResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setGroupSearchResults(await searchUsers(groupSearch));
      } catch {
        setGroupSearchResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [groupSearch]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setMemberSearchResults(await searchUsers(memberSearch));
      } catch {
        setMemberSearchResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [memberSearch]);

  const clearSidebarSearch = useCallback(() => {
    setSearch('');
    setSearchResults([]);
  }, []);

  const clearGroupSearch = useCallback(() => {
    setGroupSearch('');
    setGroupSearchResults([]);
  }, []);

  const patchSearchUser = useCallback((userId: string, updates: Partial<SearchUser>) => {
    setSearchResults(prev => prev.map(user => user.id === userId ? { ...user, ...updates } : user));
    setGroupSearchResults(prev => prev.map(user => user.id === userId ? { ...user, ...updates } : user));
    setMemberSearchResults(prev => prev.map(user => user.id === userId ? { ...user, ...updates } : user));
  }, []);

  const markChannelSubscribed = useCallback((channel: ChannelDiscoveryItem, role: ChannelDiscoveryItem['role'], memberCount: number) => {
    setChannelResults(prev => prev.map(item =>
      item.conversationId === channel.conversationId
        ? { ...item, isSubscribed: true, role, memberCount }
        : item
    ));
  }, []);

  const markChannelUnsubscribed = useCallback((channel: ChannelDiscoveryItem) => {
    setChannelResults(prev => prev.map(item =>
      item.conversationId === channel.conversationId
        ? { ...item, isSubscribed: false, role: null, memberCount: Math.max(0, item.memberCount - 1) }
        : item
    ));
  }, []);

  const markGroupJoined = useCallback((group: GroupDiscoveryItem, role: GroupDiscoveryItem['role'], memberCount: number) => {
    setGroupResults(prev => prev.map(item =>
      item.conversationId === group.conversationId
        ? { ...item, isJoined: true, role, memberCount }
        : item
    ));
  }, []);

  return {
    search,
    searchResults,
    groupResults,
    channelResults,
    discoveryActionLoading,
    groupSearch,
    groupSearchResults,
    memberSearch,
    memberSearchResults,
    setSearch,
    setDiscoveryActionLoading,
    setGroupSearch,
    setMemberSearch,
    setMemberSearchResults,
    clearSidebarSearch,
    clearGroupSearch,
    patchSearchUser,
    markChannelSubscribed,
    markChannelUnsubscribed,
    markGroupJoined,
  };
}
