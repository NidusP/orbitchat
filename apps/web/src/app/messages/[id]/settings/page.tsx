'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { GroupInvite, GroupMember, GroupMemberRole, UserSearchResult } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import {
  addGroupMembers,
  createGroupInvite,
  listGroupInvites,
  getConversation,
  leaveGroup,
  listGroupMembers,
  removeGroupMember,
  transferGroupOwner,
  updateGroupMemberRole,
  updateGroupMetadata,
  revokeGroupInvite,
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
  const [announcement, setAnnouncement] = useState('');
  const [metadataVersion, setMetadataVersion] = useState(1);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [viewerRole, setViewerRole] = useState<GroupMemberRole | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [conversation, memberList, inviteList] = await Promise.all([
        getConversation(conversationId),
        listGroupMembers(conversationId),
        listGroupInvites(conversationId).catch(() => []),
      ]);
      if (conversation.type !== 'group') {
        router.replace(`/messages/${conversationId}`);
        return;
      }
      setTitle(conversation.title ?? '');
      setAnnouncement(conversation.announcement ?? '');
      setMetadataVersion(conversation.version);
      setViewerRole(conversation.viewerRole);
      setMembers(memberList);
      setInvites(inviteList);
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
      const updated = await updateGroupMetadata(conversationId, {
        title: title.trim(),
        expectedVersion: metadataVersion,
      });
      applyMetadata(updated);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('Group name was updated by another admin. Reloading latest settings…');
        await load();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Failed to update group name.');
    } finally {
      setIsSavingTitle(false);
    }
  }

  function applyMetadata(updated: { title: string | null; announcement: string | null; version: number }): void {
    setTitle(updated.title ?? '');
    setAnnouncement(updated.announcement ?? '');
    setMetadataVersion(updated.version);
  }

  async function handleSaveAnnouncement(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canManageGroup(viewerRole)) {
      return;
    }

    const trimmed = announcement.trim();
    setIsSavingAnnouncement(true);
    setError(null);
    try {
      const updated = await updateGroupMetadata(conversationId, {
        announcement: trimmed.length > 0 ? trimmed : null,
        expectedVersion: metadataVersion,
      });
      applyMetadata(updated);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('Group announcement was updated by another admin. Reloading latest settings…');
        await load();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Failed to update announcement.');
    } finally {
      setIsSavingAnnouncement(false);
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

  async function handleCreateInvite(): Promise<void> {
    setIsCreatingInvite(true);
    setError(null);
    try {
      const invite = await createGroupInvite(conversationId);
      setInvites((current) => [invite, ...current.filter((item) => item.id !== invite.id)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create invite link.');
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(code: string): Promise<void> {
    setError(null);
    try {
      const invite = await revokeGroupInvite(code);
      setInvites((current) => current.map((item) => (item.id === invite.id ? invite : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke invite link.');
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
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Announcement</h2>
        {canManage ? (
          <form onSubmit={(event) => void handleSaveAnnouncement(event)}>
            <label className="form-field">
              <textarea
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Share an announcement with the group"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={isSavingAnnouncement}>
              {isSavingAnnouncement ? 'Saving…' : 'Save announcement'}
            </button>
          </form>
        ) : announcement ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{announcement}</p>
        ) : (
          <p className="text-muted">No announcement yet.</p>
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
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Invite links</h2>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isCreatingInvite}
            onClick={() => void handleCreateInvite()}
          >
            {isCreatingInvite ? 'Generating…' : 'Generate invite link'}
          </button>
          {invites.length > 0 && (
            <ul className="conversation-list">
              {invites.map((invite) => {
                const origin = typeof window === 'undefined' ? '' : window.location.origin;
                const inviteUrl = `${origin}/invites/${invite.code}`;
                const isRevoked = invite.revokedAt !== null;
                return (
                  <li key={invite.id} className="conversation-list-item">
                    <div className="conversation-list-main">
                      <span className="conversation-list-title">{inviteUrl}</span>
                      <span className="text-muted">
                        Uses: {invite.useCount}
                        {invite.maxUses ? `/${invite.maxUses}` : ''} {isRevoked ? '• revoked' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void navigator.clipboard.writeText(inviteUrl)}
                      >
                        Copy
                      </button>
                      {!isRevoked && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleRevokeInvite(invite.code)}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

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
