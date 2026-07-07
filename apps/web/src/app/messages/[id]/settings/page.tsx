'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { GroupMember, GroupMemberRole, UserSearchResult } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import {
  addGroupMembers,
  getConversation,
  leaveGroup,
  listGroupMembers,
  removeGroupMember,
  transferGroupOwner,
  updateGroupMemberRole,
  updateGroupTitle,
} from '@/lib/api/conversations';
import { searchUsers } from '@/lib/api/social';

function roleLabel(role: GroupMemberRole): string {
  if (role === 'owner') {
    return 'Owner';
  }
  if (role === 'admin') {
    return 'Admin';
  }
  return 'Member';
}

function canManageGroup(role: GroupMemberRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export default function GroupSettingsPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [viewerRole, setViewerRole] = useState<GroupMemberRole | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [conversation, memberList] = await Promise.all([
        getConversation(conversationId),
        listGroupMembers(conversationId),
      ]);
      if (conversation.type !== 'group') {
        router.replace(`/messages/${conversationId}`);
        return;
      }
      setTitle(conversation.title ?? '');
      setViewerRole(conversation.viewerRole);
      setMembers(memberList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load group settings.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, router]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void load();
  }, [isAuthenticated, load]);

  async function handleSaveTitle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canManageGroup(viewerRole)) {
      return;
    }

    setIsSavingTitle(true);
    setError(null);
    try {
      const updated = await updateGroupTitle(conversationId, { title: title.trim() });
      setTitle(updated.title ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update group name.');
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function runSearch(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const page = await searchUsers(trimmed, { limit: 8 });
      const memberIds = new Set(members.map((member) => member.id));
      setSearchResults(page.items.filter((item) => !memberIds.has(item.id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddMember(userId: string): Promise<void> {
    setIsAdding(true);
    setError(null);
    try {
      const updated = await addGroupMembers(conversationId, { userIds: [userId] });
      setMembers(updated);
      setSearchResults((current) => current.filter((item) => item.id !== userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveMember(targetUserId: string): Promise<void> {
    setError(null);
    try {
      await removeGroupMember(conversationId, targetUserId);
      setMembers((current) => current.filter((member) => member.id !== targetUserId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member.');
    }
  }

  async function handleRoleChange(
    targetUserId: string,
    role: 'admin' | 'member'
  ): Promise<void> {
    setError(null);
    try {
      const updated = await updateGroupMemberRole(conversationId, targetUserId, { role });
      setMembers(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role.');
    }
  }

  async function handleTransferOwner(newOwnerUserId: string): Promise<void> {
    setError(null);
    try {
      const updated = await transferGroupOwner(conversationId, { newOwnerUserId });
      setMembers(updated);
      setViewerRole('admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to transfer ownership.');
    }
  }

  async function handleLeave(): Promise<void> {
    setIsLeaving(true);
    setError(null);
    try {
      await leaveGroup(conversationId);
      router.replace('/messages');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to leave group.');
      setIsLeaving(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="main-wide">
        <SiteNav />
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  const isOwner = viewerRole === 'owner';
  const canManage = canManageGroup(viewerRole);

  return (
    <main className="main-wide">
      <SiteNav />
      <header className="page-header section-header">
        <h1>Group settings</h1>
        <Link href={`/messages/${conversationId}`} className="btn btn-secondary">
          Back to chat
        </Link>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="card form-stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Group name</h2>
        {canManage ? (
          <form onSubmit={(event) => void handleSaveTitle(event)}>
            <label className="form-field">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={isSavingTitle}>
              {isSavingTitle ? 'Saving…' : 'Save name'}
            </button>
          </form>
        ) : (
          <p>{title}</p>
        )}
      </section>

      <section className="card form-stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Members ({members.length})</h2>
        <ul className="conversation-list">
          {members.map((member) => {
            const isSelf = member.id === user?.id;
            const canKick =
              canManage &&
              !isSelf &&
              member.role !== 'owner' &&
              !(viewerRole === 'admin' && member.role === 'admin');

            return (
              <li key={member.id} className="conversation-list-item">
                <div className="conversation-list-main">
                  <span className="conversation-list-title">
                    {member.displayName} (@{member.username})
                    {isSelf ? ' (you)' : ''}
                  </span>
                  <span className="text-muted">{roleLabel(member.role)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {isOwner && !isSelf && member.role !== 'owner' && (
                    <>
                      {member.role === 'member' ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleRoleChange(member.id, 'admin')}
                        >
                          Make admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleRoleChange(member.id, 'member')}
                        >
                          Remove admin
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleTransferOwner(member.id)}
                      >
                        Transfer ownership
                      </button>
                    </>
                  )}
                  {canKick && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleRemoveMember(member.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && (
        <section className="card form-stack" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Add members</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by username"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void runSearch()}>
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="conversation-list">
              {searchResults.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className="conversation-list-item"
                    style={{ width: '100%', textAlign: 'left' }}
                    disabled={isAdding}
                    onClick={() => void handleAddMember(result.id)}
                  >
                    <span className="conversation-list-title">
                      {result.displayName} (@{result.username})
                    </span>
                    <span className="text-muted">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {viewerRole !== 'owner' && (
        <section className="card form-stack">
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Leave group</h2>
          <p className="text-muted">You will no longer receive messages from this group.</p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isLeaving}
            onClick={() => void handleLeave()}
          >
            {isLeaving ? 'Leaving…' : 'Leave group'}
          </button>
        </section>
      )}

      {isOwner && (
        <p className="text-muted" style={{ marginTop: 16 }}>
          Transfer ownership to another member before you can leave the group.
        </p>
      )}
    </main>
  );
}
