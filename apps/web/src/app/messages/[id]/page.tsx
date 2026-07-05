'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { useChatWs } from '@/contexts/chat-ws-context';
import { ApiError } from '@/lib/api/errors';
import {
  getConversation,
  getOtherParticipant,
  listMessages,
  markConversationRead,
  sendMessage,
} from '@/lib/api/conversations';

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const map = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }
  return [...map.values()].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { subscribe } = useChatWs();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const otherParticipant = useMemo(() => {
    if (!conversation || !user) {
      return null;
    }
    return getOtherParticipant(conversation, user.id);
  }, [conversation, user]);

  const loadInitial = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [conversationRecord, messagePage] = await Promise.all([
        getConversation(conversationId),
        listMessages(conversationId, { limit: 50 }),
      ]);
      setConversation(conversationRecord);
      setMessages(mergeMessages([], messagePage.items));
      setNextCursor(messagePage.nextCursor);
      await markConversationRead(conversationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load conversation.');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadInitial();
  }, [isAuthenticated, loadInitial]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== 'message.new' || event.payload.conversationId !== conversationId) {
        return;
      }
      setMessages((current) => mergeMessages(current, [event.payload.message]));
      if (event.payload.message.sender.id !== user?.id) {
        void markConversationRead(conversationId);
      }
    });
  }, [conversationId, subscribe, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    const list = listRef.current;
    const previousHeight = list?.scrollHeight ?? 0;

    setIsLoadingMore(true);
    try {
      const page = await listMessages(conversationId, { cursor: nextCursor, limit: 50 });
      setMessages((current) => mergeMessages(page.items, current));
      setNextCursor(page.nextCursor);
      requestAnimationFrame(() => {
        if (list) {
          list.scrollTop = list.scrollHeight - previousHeight;
        }
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load older messages.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const message = await sendMessage(conversationId, { content });
      setMessages((current) => mergeMessages(current, [message]));
      setDraft('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send message.');
    } finally {
      setIsSending(false);
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

  if (!conversation) {
    return (
      <main className="main-wide">
        <SiteNav />
        <div className="alert alert-error">{error ?? 'Conversation not found.'}</div>
        <p style={{ marginTop: 16 }}>
          <Link href="/messages">Back to messages</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="main-wide chat-page">
      <SiteNav />
      <header className="page-header section-header">
        <div>
          <h1>{otherParticipant?.displayName ?? 'Chat'}</h1>
          {otherParticipant && (
            <p className="text-muted">@{otherParticipant.username}</p>
          )}
        </div>
        {otherParticipant && (
          <Link href={`/users/${otherParticipant.id}`} className="btn btn-secondary btn-sm">
            Profile
          </Link>
        )}
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="chat-panel card">
        {nextCursor && (
          <div className="chat-load-more">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isLoadingMore}
              onClick={() => void handleLoadMore()}
            >
              {isLoadingMore ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 ? (
            <p className="text-muted chat-empty">Say hello to start the conversation.</p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender.id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`chat-bubble-row ${isMine ? 'chat-bubble-row-mine' : 'chat-bubble-row-theirs'}`}
                >
                  <div className={`chat-bubble ${isMine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
                    <p className="chat-bubble-content">{message.content}</p>
                    <time className="chat-bubble-time" dateTime={message.createdAt}>
                      {formatMessageTime(message.createdAt)}
                    </time>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form className="chat-composer" onSubmit={(event) => void handleSubmit(event)}>
          <textarea
            className="chat-input"
            rows={2}
            value={draft}
            placeholder="Write a message…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={isSending || !draft.trim()}>
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>

      <p className="text-muted" style={{ marginTop: 16 }}>
        <Link href="/messages">Back to messages</Link>
      </p>
    </main>
  );
}
