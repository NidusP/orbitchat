'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { GroupInvite, GroupMember, GroupMemberRole, UserSearchResult } from '@orbitchat/shared-types';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
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

function roleLabel(
  role: GroupMemberRole,
  t: (key: 'groupSettings.roles.owner' | 'groupSettings.roles.admin' | 'groupSettings.roles.member') => string
): string {
  if (role === 'owner') {
    return t('groupSettings.roles.owner');
  }
  if (role === 'admin') {
    return t('groupSettings.roles.admin');
  }
  return t('groupSettings.roles.member');
}

function canManageGroup(role: GroupMemberRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export default function GroupSettingsPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();

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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.load'));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, router, t]);

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
        setError(t('groupSettings.errors.titleConflict'));
        await load();
        return;
      }
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.titleUpdate'));
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
        setError(t('groupSettings.errors.announcementConflict'));
        await load();
        return;
      }
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.announcementUpdate'));
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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.search'));
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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.addMember'));
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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.removeMember'));
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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.updateRole'));
    }
  }

  async function handleTransferOwner(newOwnerUserId: string): Promise<void> {
    setError(null);
    try {
      const updated = await transferGroupOwner(conversationId, { newOwnerUserId });
      setMembers(updated);
      setViewerRole('admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.transferOwnership'));
    }
  }

  async function handleLeave(): Promise<void> {
    setIsLeaving(true);
    setError(null);
    try {
      await leaveGroup(conversationId);
      router.replace('/messages');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.leave'));
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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.createInvite'));
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
      setError(err instanceof ApiError ? err.message : t('groupSettings.errors.revokeInvite'));
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="main-wide">
        <p className="text-muted">{t('groupSettings.loading')}</p>
      </main>
    );
  }

  const isOwner = viewerRole === 'owner';
  const canManage = canManageGroup(viewerRole);

  return (
    <main className="main-wide">
      <header className="page-header section-header">
        <h1>{t('groupSettings.title')}</h1>
        <Link href={`/messages/${conversationId}`} className="btn btn-secondary">
          {t('groupSettings.backToChat')}
        </Link>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="card form-stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('groupSettings.sections.groupName')}</h2>
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
              {isSavingTitle ? t('groupSettings.actions.saving') : t('groupSettings.actions.saveName')}
            </button>
          </form>
        ) : (
          <p>{title}</p>
        )}
      </section>

      <section className="card form-stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('groupSettings.sections.announcement')}</h2>
        {canManage ? (
          <form onSubmit={(event) => void handleSaveAnnouncement(event)}>
            <label className="form-field">
              <textarea
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={t('groupSettings.placeholders.announcement')}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={isSavingAnnouncement}>
              {isSavingAnnouncement
                ? t('groupSettings.actions.saving')
                : t('groupSettings.actions.saveAnnouncement')}
            </button>
          </form>
        ) : announcement ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{announcement}</p>
        ) : (
          <p className="text-muted">{t('groupSettings.labels.noAnnouncement')}</p>
        )}
      </section>

      <section className="card form-stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>
          {t('groupSettings.sections.members', { count: members.length })}
        </h2>
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
                    {isSelf ? t('groupSettings.labels.youSuffix') : ''}
                  </span>
                  <span className="text-muted">{roleLabel(member.role, t)}</span>
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
                          {t('groupSettings.actions.makeAdmin')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleRoleChange(member.id, 'member')}
                        >
                          {t('groupSettings.actions.removeAdmin')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleTransferOwner(member.id)}
                      >
                        {t('groupSettings.actions.transferOwnership')}
                      </button>
                    </>
                  )}
                  {canKick && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleRemoveMember(member.id)}
                    >
                      {t('groupSettings.actions.remove')}
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
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('groupSettings.sections.inviteLinks')}</h2>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isCreatingInvite}
            onClick={() => void handleCreateInvite()}
          >
            {isCreatingInvite
              ? t('groupSettings.actions.generating')
              : t('groupSettings.actions.generateInviteLink')}
          </button>
          {invites.length > 0 && (
            <ul className="conversation-list">
              {invites.map((invite) => {
                const origin = typeof window === 'undefined' ? '' : window.location.origin;
                const inviteUrl = `${origin}/invites/${invite.code}`;
                const isRevoked = invite.revokedAt !== null;
                const maxUsesLabel = invite.maxUses ? `/${invite.maxUses}` : '';
                const revokedLabel = isRevoked ? ` (${t('groupSettings.labels.inviteRevoked')})` : '';
                return (
                  <li key={invite.id} className="conversation-list-item">
                    <div className="conversation-list-main">
                      <span className="conversation-list-title">{inviteUrl}</span>
                      <span className="text-muted">
                        {t('groupSettings.labels.inviteUses', {
                          used: invite.useCount,
                          max: maxUsesLabel,
                        })}
                        {revokedLabel}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void navigator.clipboard.writeText(inviteUrl)}
                      >
                        {t('groupSettings.actions.copy')}
                      </button>
                      {!isRevoked && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleRevokeInvite(invite.code)}
                        >
                          {t('groupSettings.actions.revoke')}
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
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('groupSettings.sections.addMembers')}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('groupSettings.placeholders.searchByUsername')}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void runSearch()}>
              {isSearching ? t('groupSettings.actions.searching') : t('groupSettings.actions.search')}
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
                    <span className="text-muted">{t('groupSettings.actions.add')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {viewerRole !== 'owner' && (
        <section className="card form-stack">
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('groupSettings.sections.leaveGroup')}</h2>
          <p className="text-muted">{t('groupSettings.labels.leaveDescription')}</p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isLeaving}
            onClick={() => void handleLeave()}
          >
            {isLeaving ? t('groupSettings.actions.leaving') : t('groupSettings.actions.leaveGroup')}
          </button>
        </section>
      )}

      {isOwner && (
        <p className="text-muted" style={{ marginTop: 16 }}>
          {t('groupSettings.labels.ownerLeaveHint')}
        </p>
      )}
    </main>
  );
}
