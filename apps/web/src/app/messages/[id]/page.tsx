'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message, MessageEditRecord, MessageRecall } from '@orbitchat/shared-types';
import { useAuth } from '@/contexts/auth-context';
import { useChatWs } from '@/contexts/chat-ws-context';
import { ApiError } from '@/lib/api/errors';
import {
  deleteMessage,
  getConversation,
  getConversationDisplayName,
  listMessageEdits,
  listMessages,
  markConversationRead,
  sendMessage,
  updateMessage,
} from '@/lib/api/conversations';

const MESSAGE_RECALL_WINDOW_MS = 3 * 60 * 1000;
const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

type TimelineItem =
  | { kind: 'message'; message: Message }
  | { kind: 'recall'; recall: MessageRecall };

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

function mergeRecalls(current: MessageRecall[], incoming: MessageRecall[]): MessageRecall[] {
  const map = new Map(current.map((recall) => [recall.id, recall]));
  for (const recall of incoming) {
    map.set(recall.id, recall);
  }
  return [...map.values()].sort(
    (left, right) =>
      left.messageCreatedAt.localeCompare(right.messageCreatedAt) || left.id.localeCompare(right.id)
  );
}

function buildTimeline(messages: Message[], recalls: MessageRecall[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((message) => ({ kind: 'message' as const, message })),
    ...recalls.map((recall) => ({ kind: 'recall' as const, recall })),
  ];

  return items.sort((left, right) => {
    const leftAt = left.kind === 'message' ? left.message.createdAt : left.recall.messageCreatedAt;
    const leftId = left.kind === 'message' ? left.message.id : left.recall.id;
    const rightAt = right.kind === 'message' ? right.message.createdAt : right.recall.messageCreatedAt;
    const rightId = right.kind === 'message' ? right.message.id : right.recall.id;
    return leftAt.localeCompare(rightAt) || leftId.localeCompare(rightId);
  });
}

function canRecallMessage(message: Message, nowMs: number): boolean {
  return nowMs - new Date(message.createdAt).getTime() <= MESSAGE_RECALL_WINDOW_MS;
}

function canEditMessage(message: Message, nowMs: number): boolean {
  return nowMs - new Date(message.createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS;
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { subscribe, sendTyping, isConnected } = useChatWs();

  const [conversation, setConversation] = useState<Awaited<ReturnType<typeof getConversation>> | null>(
    null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [recalls, setRecalls] = useState<MessageRecall[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRetryingSend, setIsRetryingSend] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [historyMessageId, setHistoryMessageId] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<MessageEditRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerTitle = useMemo(() => {
    if (!conversation || !user) {
      return '聊天';
    }
    return getConversationDisplayName(conversation, user.id);
  }, [conversation, user]);

  const otherParticipant = useMemo(() => {
    if (!conversation || conversation.type !== 'direct') {
      return null;
    }
    return conversation.participants.find((participant) => participant.id !== user?.id) ?? null;
  }, [conversation, user?.id]);

  const memberCount =
    conversation?.type === 'group' ? conversation.participants.length : null;

  const connectionStatusLabel = !isConnected
    ? hasConnectedOnce
      ? '已断开，正在重连…'
      : '连接中…'
    : null;

  const timeline = useMemo(() => buildTimeline(messages, recalls), [messages, recalls]);

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
      setRecalls(mergeRecalls([], messagePage.recalls));
      setNextCursor(messagePage.nextCursor);
      await markConversationRead(conversationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '会话加载失败，请稍后重试。');
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
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isConnected) {
      setHasConnectedOnce(true);
    }
  }, [isConnected]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.payload.conversationId !== conversationId) {
        return;
      }

      if (event.type === 'message.new') {
        setMessages((current) => mergeMessages(current, [event.payload.message]));
        if (event.payload.message.sender.id !== user?.id) {
          void markConversationRead(conversationId);
        }
        return;
      }

      if (event.type === 'message.recalled') {
        setMessages((current) => current.filter((item) => item.id !== event.payload.recall.messageId));
        setRecalls((current) => mergeRecalls(current, [event.payload.recall]));
        return;
      }

      if (event.type === 'typing.started') {
        if (event.payload.userId !== user?.id) {
          setTypingLabel(event.payload.displayName);
        }
        return;
      }

      if (event.type === 'typing.stopped') {
        if (event.payload.userId !== user?.id) {
          setTypingLabel(null);
        }
        return;
      }

      if (event.type === 'member.joined' && conversation?.type === 'group') {
        setConversation((current) => {
          if (!current) {
            return current;
          }
          const exists = current.participants.some(
            (participant) => participant.id === event.payload.member.id
          );
          if (exists) {
            return current;
          }
          return {
            ...current,
            participants: [...current.participants, event.payload.member],
          };
        });
      }
    });
  }, [conversation?.type, conversationId, subscribe, user?.id]);

  const notifyTyping = useCallback(() => {
    if (conversation && conversation.type !== 'direct') {
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(conversationId, 'started');
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(conversationId, 'stopped');
    }, 3000);
  }, [conversation, conversationId, sendTyping]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(conversationId, 'stopped');
    }
  }, [conversationId, sendTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

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
      setRecalls((current) => mergeRecalls(current, page.recalls));
      setNextCursor(page.nextCursor);
      requestAnimationFrame(() => {
        if (list) {
          list.scrollTop = list.scrollHeight - previousHeight;
        }
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更早消息加载失败，请稍后重试。');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending || isRetryingSend) {
      return;
    }

    setIsSending(true);
    setError(null);
    setSendError(null);
    stopTyping();
    try {
      const message = await sendMessage(conversationId, { content });
      setMessages((current) => mergeMessages(current, [message]));
      setDraft('');
      setLastFailedContent(null);
    } catch {
      setSendError('消息发送失败，请重试。');
      setLastFailedContent(content);
    } finally {
      setIsSending(false);
    }
  }

  async function handleRetrySend(): Promise<void> {
    if (!lastFailedContent || isSending || isRetryingSend) {
      return;
    }

    const retryContent = lastFailedContent;
    setIsRetryingSend(true);
    setError(null);
    setSendError(null);
    stopTyping();
    try {
      const message = await sendMessage(conversationId, { content: retryContent });
      setMessages((current) => mergeMessages(current, [message]));
      setDraft((currentDraft) =>
        currentDraft.trim() === retryContent ? '' : currentDraft
      );
      setLastFailedContent(null);
    } catch {
      setSendError('消息发送失败，请重试。');
    } finally {
      setIsRetryingSend(false);
    }
  }

  async function handleRecall(messageId: string): Promise<void> {
    if (!messages.some((item) => item.id === messageId)) {
      return;
    }

    if (!window.confirm('确认撤回这条消息吗？')) {
      return;
    }

    setActionMessageId(messageId);
    setError(null);
    try {
      await deleteMessage(conversationId, messageId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '撤回失败，请稍后重试。');
    } finally {
      setActionMessageId(null);
    }
  }

  async function handleSaveEdit(messageId: string, originalContent: string): Promise<void> {
    const content = editDraft.trim();
    if (!content) {
      return;
    }
    if (content === originalContent) {
      setError('消息内容未变更。');
      return;
    }

    setActionMessageId(messageId);
    setError(null);
    try {
      const updated = await updateMessage(conversationId, messageId, { content });
      setMessages((current) => mergeMessages(current, [updated]));
      setEditingMessageId(null);
      setEditDraft('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '编辑失败，请稍后重试。');
    } finally {
      setActionMessageId(null);
    }
  }

  async function handleShowEditHistory(messageId: string): Promise<void> {
    setHistoryMessageId(messageId);
    setIsLoadingHistory(true);
    setError(null);
    try {
      const history = await listMessageEdits(conversationId, messageId);
      setEditHistory(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '编辑历史加载失败，请稍后重试。');
      setHistoryMessageId(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="main-wide">
        <div className="chat-loading-state">
          <p className="text-muted">加载中…</p>
          <div className="chat-loading-skeleton" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (!conversation) {
    return (
      <main className="main-wide">
        <div className="alert alert-error">{error ?? '会话不存在或已被删除。'}</div>
        <p style={{ marginTop: 16 }}>
          <Link href="/messages">返回消息列表</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="main-wide chat-page">
      <span hidden data-testid="chat-ws-connected">
        {isConnected ? 'yes' : 'no'}
      </span>
      <header className="chat-conversation-header">
        <Link href="/messages" className="chat-conversation-back">
          ← 消息
        </Link>
        <div className="chat-conversation-title-block">
          <h1>{headerTitle}</h1>
          {conversation.type === 'group' ? (
            <p className="text-muted">{memberCount} 位成员</p>
          ) : otherParticipant ? (
            <p className="text-muted">@{otherParticipant.username}</p>
          ) : null}
        </div>
        <div className="chat-conversation-actions">
          {connectionStatusLabel ? (
            <span className="chat-connection-status">{connectionStatusLabel}</span>
          ) : (
            <span className="chat-connection-status chat-connection-status-online" title="连接正常" />
          )}
          {conversation.type === 'group' ? (
            <Link href={`/messages/${conversationId}/settings`} className="btn btn-secondary btn-sm">
              群设置
            </Link>
          ) : otherParticipant ? (
            <Link href={`/users/${otherParticipant.id}`} className="btn btn-secondary btn-sm">
              主页
            </Link>
          ) : null}
        </div>
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
              {isLoadingMore ? '加载中…' : '加载更早消息'}
            </button>
          </div>
        )}

        <div className="chat-messages" ref={listRef}>
          {timeline.length === 0 ? (
            <p className="text-muted chat-empty">发条消息开始聊天吧。</p>
          ) : (
            timeline.map((item) => {
              if (item.kind === 'recall') {
                return (
                  <p key={`recall-${item.recall.id}`} className="chat-system-notice">
                    {item.recall.recalledBy.displayName} 撤回了一条消息
                  </p>
                );
              }

              const message = item.message;
              const isMine = message.sender.id === user?.id;
              const isEditing = editingMessageId === message.id;
              const showRecall = isMine && canRecallMessage(message, nowMs);
              const showEdit = isMine && canEditMessage(message, nowMs);
              const editUnchanged = editDraft.trim() === message.content;

              return (
                <div
                  key={message.id}
                  className={`chat-bubble-row ${isMine ? 'chat-bubble-row-mine' : 'chat-bubble-row-theirs'}`}
                >
                  <div className={`chat-bubble ${isMine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
                    {isEditing ? (
                      <div className="chat-edit-form">
                        <textarea
                          className="chat-input"
                          rows={2}
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                        />
                        <div className="chat-message-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={
                              actionMessageId === message.id || !editDraft.trim() || editUnchanged
                            }
                            onClick={() => void handleSaveEdit(message.id, message.content)}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditDraft('');
                            }}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="chat-bubble-content">{message.content}</p>
                        <div className="chat-bubble-meta">
                          <time className="chat-bubble-time" dateTime={message.createdAt}>
                            {formatMessageTime(message.createdAt)}
                          </time>
                          {message.editedAt && (
                            <button
                              type="button"
                              className="chat-edited-label"
                              onClick={() => void handleShowEditHistory(message.id)}
                            >
                              已编辑
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    {isMine && !isEditing && (showEdit || showRecall) && (
                      <div className="chat-message-actions">
                        {showEdit && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={actionMessageId === message.id}
                            onClick={() => {
                              setEditingMessageId(message.id);
                              setEditDraft(message.content);
                            }}
                          >
                            编辑
                          </button>
                        )}
                        {showRecall && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={actionMessageId === message.id}
                            onClick={() => void handleRecall(message.id)}
                          >
                            撤回
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {typingLabel && (
          <p className="chat-typing-indicator" data-testid="chat-typing-indicator" aria-live="polite">
            {typingLabel} 正在输入…
          </p>
        )}

        {sendError && (
          <div className="chat-send-error" role="alert">
            <span>{sendError}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!lastFailedContent || isRetryingSend || isSending}
              onClick={() => void handleRetrySend()}
            >
              {isRetryingSend ? '重试中…' : '重试'}
            </button>
          </div>
        )}

        <form className="chat-composer" onSubmit={(event) => void handleSubmit(event)}>
          <textarea
            className="chat-input"
            rows={2}
            value={draft}
            placeholder="输入消息，Enter 发送"
            onChange={(event) => {
              setDraft(event.target.value);
              notifyTyping();
            }}
            onBlur={() => stopTyping()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSending || isRetryingSend || !draft.trim()}
          >
            {isSending ? '发送中…' : '发送'}
          </button>
        </form>
      </div>

      {historyMessageId && (
        <div className="chat-history-overlay" role="dialog" aria-modal="true">
          <div className="card chat-history-panel">
            <header className="section-header">
              <h2 style={{ margin: 0, fontSize: '1.125rem' }}>编辑历史</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setHistoryMessageId(null);
                  setEditHistory([]);
                }}
              >
                关闭
              </button>
            </header>
            {isLoadingHistory ? (
              <p className="text-muted">加载中…</p>
            ) : editHistory.length === 0 ? (
              <p className="text-muted">暂无编辑记录。</p>
            ) : (
              <ul className="chat-history-list">
                {editHistory.map((entry) => (
                  <li key={entry.id} className="chat-history-item">
                    <time className="text-muted">{formatMessageTime(entry.editedAt)}</time>
                    <p>{entry.previousContent}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
