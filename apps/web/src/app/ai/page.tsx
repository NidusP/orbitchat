'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, AiConversation, AiMessage, AiSseEvent, AiToolCall } from '@orbitchat/shared-types';
import { parseTicTacToeToolContent, TicTacToeBoard } from '@/components/tic-tac-toe-board';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import {
  createAiConversation,
  approveAiToolCall,
  listAgents,
  listAiConversations,
  listAiMessages,
  listAiToolCalls,
  rejectAiToolCall,
  sendAiMessageStream,
  sortAiMessages,
} from '@/lib/api/ai';
import { ApiError } from '@/lib/api/errors';
import type { I18nKey, MessageValues } from '@/lib/i18n';
import {
  buildCitationsByAssistantMessage,
  countToolOutputItems,
  formatAiError,
  formatToolMessageContent,
  resolveAgentDisplayName,
} from '@/lib/ai-agent-ui';

const AI_SUGGESTION_KEYS = [
  'ai.suggestion.memoryLatte',
  'ai.suggestion.recentPosts',
  'ai.suggestion.weekendPost',
  'ai.suggestion.ticTacToe',
] as const satisfies readonly I18nKey[];

type TranslateFn = (key: I18nKey, values?: MessageValues) => string;

function createLocalMessage(input: {
  conversationId: string;
  role: AiMessage['role'];
  content: string;
  toolName?: string | null;
}): AiMessage {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    toolName: input.toolName ?? null,
    createdAt: new Date().toISOString(),
  };
}

function mergeAiMessages(current: AiMessage[], incoming: AiMessage[]): AiMessage[] {
  const map = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }
  return sortAiMessages([...map.values()]);
}

function isAiToolCall(value: unknown): value is AiToolCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'toolName' in value &&
    'status' in value &&
    typeof value.id === 'string' &&
    typeof value.toolName === 'string' &&
    typeof value.status === 'string'
  );
}

function extractToolCall(output: unknown): AiToolCall | null {
  if (typeof output !== 'object' || output === null || !('toolCall' in output)) {
    return null;
  }

  const toolCall = output.toolCall;
  return isAiToolCall(toolCall) ? toolCall : null;
}

function formatCaughtAiError(err: unknown, t: TranslateFn): string {
  if (err instanceof ApiError) {
    return formatAiError(err.code, err.message);
  }
  return t('ai.errors.sendFailed');
}

function describeToolCall(toolCall: AiToolCall, t: TranslateFn): string {
  const input =
    typeof toolCall.input === 'object' && toolCall.input !== null ? toolCall.input : {};

  switch (toolCall.toolName) {
    case 'send_dm': {
      const targetUsername =
        'targetUsername' in input && typeof input.targetUsername === 'string'
          ? input.targetUsername
          : t('ai.toolCall.describe.unknownUser');
      const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
      return t('ai.toolCall.describe.sendDm', {
        targetUsername,
        contentSuffix: content ? `: ${content}` : '',
      });
    }
    case 'create_post': {
      const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
      return content
        ? t('ai.toolCall.describe.createPost', { content })
        : t('ai.toolCall.describe.createPostNoContent');
    }
    case 'follow_user':
    case 'unfollow_user': {
      const targetUsername =
        'targetUsername' in input && typeof input.targetUsername === 'string'
          ? input.targetUsername
          : t('ai.toolCall.describe.unknownUser');
      if (toolCall.toolName === 'follow_user') {
        return t('ai.toolCall.describe.follow', { targetUsername });
      }
      return t('ai.toolCall.describe.unfollow', { targetUsername });
    }
    case 'remember_fact': {
      const kind =
        'kind' in input && typeof input.kind === 'string'
          ? input.kind
          : t('ai.toolCall.describe.rememberKindDefault');
      const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
      return t('ai.toolCall.describe.rememberFact', { kind, content });
    }
    default:
      return t('ai.toolCall.describe.default', { toolName: toolCall.toolName });
  }
}

function getToolCallApprovalTitle(toolCall: AiToolCall, t: TranslateFn): string {
  switch (toolCall.toolName) {
    case 'send_dm':
      return t('ai.toolCall.approval.send_dm');
    case 'create_post':
      return t('ai.toolCall.approval.create_post');
    case 'follow_user':
      return t('ai.toolCall.approval.follow_user');
    case 'unfollow_user':
      return t('ai.toolCall.approval.unfollow_user');
    case 'remember_fact':
      return t('ai.toolCall.approval.remember_fact');
    default:
      return t('ai.toolCall.approval.default');
  }
}

function describeRunningTool(toolName: string, t: TranslateFn): string {
  switch (toolName) {
    case 'search_contact':
      return t('ai.toolCall.running.search_contact');
    case 'get_my_profile':
      return t('ai.toolCall.running.get_my_profile');
    case 'list_my_recent_posts':
      return t('ai.toolCall.running.list_my_recent_posts');
    case 'search_my_posts':
      return t('ai.toolCall.running.search_my_posts');
    case 'search_help_docs':
      return t('ai.toolCall.running.search_help_docs');
    case 'get_user_profile':
      return t('ai.toolCall.running.get_user_profile');
    case 'list_user_recent_posts':
      return t('ai.toolCall.running.list_user_recent_posts');
    case 'play_tictactoe':
      return t('ai.toolCall.running.play_tictactoe');
    case 'send_dm':
      return t('ai.toolCall.running.send_dm');
    case 'create_post':
      return t('ai.toolCall.running.create_post');
    case 'follow_user':
      return t('ai.toolCall.running.follow_user');
    case 'unfollow_user':
      return t('ai.toolCall.running.unfollow_user');
    case 'remember_fact':
      return t('ai.toolCall.running.remember_fact');
    default:
      return t('ai.toolCall.running.default', { toolName });
  }
}

function executedToolMessage(toolCall: AiToolCall, t: TranslateFn): string {
  switch (toolCall.toolName) {
    case 'send_dm':
      return t('ai.toolCall.executed.send_dm');
    case 'create_post':
      return t('ai.toolCall.executed.create_post');
    case 'follow_user':
      return t('ai.toolCall.executed.follow_user');
    case 'unfollow_user':
      return t('ai.toolCall.executed.unfollow_user');
    case 'remember_fact':
      return t('ai.toolCall.executed.remember_fact');
    case 'search_my_posts':
      return t('ai.toolCall.executed.search_my_posts', {
        count: countToolOutputItems(toolCall.output),
      });
    case 'search_help_docs':
      return t('ai.toolCall.executed.search_help_docs', {
        count: countToolOutputItems(toolCall.output),
      });
    case 'list_my_recent_posts':
      return t('ai.toolCall.executed.list_my_recent_posts', {
        count: countToolOutputItems(toolCall.output),
      });
    default:
      return t('ai.toolCall.executed.default');
  }
}

export default function AiPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<AiToolCall[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [toolRunningStatus, setToolRunningStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  );

  const citationsByAssistantId = useMemo(
    () => buildCitationsByAssistantMessage(messages),
    [messages]
  );

  const suggestionChips = useMemo(() => AI_SUGGESTION_KEYS.map((key) => t(key)), [t]);

  const loadInitial = useCallback(async () => {
    setIsLoadingPage(true);
    setError(null);
    try {
      const [agentList, conversationPage] = await Promise.all([
        listAgents(),
        listAiConversations({ limit: 20 }),
      ]);
      setAgents(agentList);
      setSelectedAgentId(agentList[0]?.id ?? '');
      setConversations(conversationPage.items);
      setSelectedConversationId(conversationPage.items[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('ai.errors.pageLoadFailed'));
    } finally {
      setIsLoadingPage(false);
    }
  }, [t]);

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
    if (!selectedConversationId) {
      setMessages([]);
      setToolCalls([]);
      return;
    }

    const conversationId = selectedConversationId;
    let cancelled = false;
    async function loadMessages() {
      setError(null);
      try {
        const [messagePage, toolCallPage] = await Promise.all([
          listAiMessages(conversationId, { limit: 50 }),
          listAiToolCalls(conversationId, { limit: 20 }),
        ]);
        if (!cancelled) {
          setMessages(sortAiMessages(messagePage.items));
          setToolCalls(toolCallPage.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('ai.errors.conversationLoadFailed'));
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleNewChat() {
    if (!selectedAgentId || isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const conversation = await createAiConversation({ agentId: selectedAgentId });
      setConversations((current) => [conversation, ...current]);
      setSelectedConversationId(conversation.id);
      setMessages([]);
      setToolCalls([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('ai.errors.createConversationFailed'));
    } finally {
      setIsCreating(false);
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (selectedConversationId) {
      return selectedConversationId;
    }
    if (!selectedAgentId) {
      setError(t('ai.errors.selectAssistantFirst'));
      return null;
    }
    const conversation = await createAiConversation({ agentId: selectedAgentId });
    setConversations((current) => [conversation, ...current]);
    setSelectedConversationId(conversation.id);
    return conversation.id;
  }

  function applyAiEvent(event: AiSseEvent, assistantMessageId: string, titleSeed: string) {
    if (event.type === 'run.started') {
      setIsThinking(true);
      return;
    }

    if (event.type === 'tool.started') {
      setIsThinking(false);
      setToolRunningStatus(describeRunningTool(event.payload.toolName, t));
      return;
    }

    if (event.type === 'tool.call') {
      setToolRunningStatus(null);
      const toolCall = extractToolCall(event.payload.output);
      if (toolCall) {
        setToolCalls((current) => [toolCall, ...current.filter((item) => item.id !== toolCall.id)]);
      }
      setMessages((current) =>
        mergeAiMessages(current, [
          createLocalMessage({
            conversationId: event.payload.conversationId,
            role: 'tool',
            toolName: event.payload.toolName,
            content: JSON.stringify(event.payload.output, null, 2),
          }),
        ])
      );
      return;
    }

    if (event.type === 'message.delta') {
      setIsThinking(false);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: `${message.content}${event.payload.delta}` }
            : message
        )
      );
      return;
    }

    if (event.type === 'message.done') {
      setIsThinking(false);
      setToolRunningStatus(null);
      setMessages((current) =>
        mergeAiMessages(
          current.filter((message) => message.id !== assistantMessageId),
          [event.payload.message]
        )
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === event.payload.conversationId
            ? {
                ...conversation,
                title: conversation.title ?? titleSeed.slice(0, 80),
                lastMessageAt: event.payload.message.createdAt,
                updatedAt: event.payload.message.createdAt,
              }
            : conversation
        )
      );
      return;
    }

    if (event.type === 'error') {
      setIsThinking(false);
      setToolRunningStatus(null);
      setError(formatAiError(event.payload.code, event.payload.message));
    }
  }

  async function handleToolCallAction(toolCallId: string, action: 'approve' | 'reject') {
    setError(null);
    try {
      const updated =
        action === 'approve'
          ? await approveAiToolCall(toolCallId)
          : await rejectAiToolCall(toolCallId);
      setToolCalls((current) =>
        current.map((toolCall) => (toolCall.id === updated.id ? updated : toolCall))
      );
      if (updated.status === 'executed') {
        setMessages((current) =>
          mergeAiMessages(current, [
            createLocalMessage({
              conversationId: updated.conversationId,
              role: 'tool',
              toolName: updated.toolName,
              content: executedToolMessage(updated, t),
            }),
          ])
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t(action === 'approve' ? 'ai.errors.approveFailed' : 'ai.errors.rejectFailed')
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    setIsThinking(false);
    setToolRunningStatus(null);
    setError(null);

    streamAbortRef.current?.abort();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    try {
      const conversationId = await ensureConversation();
      if (!conversationId) {
        return;
      }

      const localUserMessage = createLocalMessage({
        conversationId,
        role: 'user',
        content,
      });
      const localAssistantMessage = createLocalMessage({
        conversationId,
        role: 'assistant',
        content: '',
      });
      setMessages((current) => mergeAiMessages(current, [localUserMessage, localAssistantMessage]));
      setDraft('');

      await sendAiMessageStream(
        conversationId,
        { content },
        (aiEvent) => {
          applyAiEvent(aiEvent, localAssistantMessage.id, content);
        },
        { signal: abortController.signal }
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(formatCaughtAiError(err, t));
    } finally {
      if (streamAbortRef.current === abortController) {
        streamAbortRef.current = null;
      }
      setIsSending(false);
      setIsThinking(false);
      setToolRunningStatus(null);
    }
  }

  if (authLoading || isLoadingPage) {
    return (
      <main className="main-wide">
        <p className="text-muted">{t('messages.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide chat-page">
      <header className="page-header section-header">
        <div>
          <h1>{t('ai.title')}</h1>
          <p className="text-muted">{t('ai.description')}</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
            <Link href="/ai/memories">{t('ai.manageMemories')}</Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="chat-select"
            value={selectedAgentId}
            onChange={(event) => setSelectedAgentId(event.target.value)}
            disabled={agents.length === 0}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {resolveAgentDisplayName(agent, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selectedAgentId || isCreating}
            onClick={() => void handleNewChat()}
          >
            {isCreating ? t('ai.creatingConversation') : t('ai.newConversation')}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="ai-layout">
        <aside className="ai-sidebar card">
          <h2 className="section-title">{t('ai.section.conversations')}</h2>
          {conversations.length === 0 ? (
            <p className="text-muted">{t('ai.emptyConversations')}</p>
          ) : (
            <div className="ai-conversation-list">
              {conversations.map((conversation) => {
                const agent = agentsById.get(conversation.agentId);
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`ai-conversation-button ${
                      conversation.id === selectedConversationId ? 'ai-conversation-button-active' : ''
                    }`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <span>
                      {conversation.title ??
                        t('ai.conversationTitleFallback', {
                          agentName: resolveAgentDisplayName(agent, t),
                        })}
                    </span>
                    <small>{resolveAgentDisplayName(agent, t)}</small>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="chat-panel card">
          <div className="ai-agent-summary">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#7c2d12',
                  background: 'linear-gradient(180deg, #ffedd5, #fed7aa)',
                  border: '1px solid #fdba74',
                }}
              >
                {t('ai.avatarInitial')}
              </div>
              <div style={{ display: 'grid', gap: 2 }}>
                <strong>{t('ai.title')}</strong>
                <span>{t('ai.description')}</span>
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {toolCalls.some((toolCall) => toolCall.status === 'pending') && (
              <div className="ai-tool-call-stack">
                {toolCalls
                  .filter((toolCall) => toolCall.status === 'pending')
                  .map((toolCall) => (
                    <div key={toolCall.id} className="ai-tool-call-card">
                      <div>
                        <strong>{getToolCallApprovalTitle(toolCall, t)}</strong>
                        <p>{describeToolCall(toolCall, t)}</p>
                        {toolCall.toolName === 'remember_fact' && (
                          <p className="ai-tool-call-helper">
                            {t('ai.rememberFactHelper')}{' '}
                            <Link href="/ai/memories">{t('ai.manageMemories')}</Link>
                          </p>
                        )}
                      </div>
                      <div className="ai-tool-call-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleToolCallAction(toolCall.id, 'approve')}
                        >
                          {t('ai.actions.approve')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleToolCallAction(toolCall.id, 'reject')}
                        >
                          {t('ai.actions.reject')}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>{t('ai.emptyGreeting')}</p>
                <p className="text-muted" style={{ marginBottom: 12 }}>
                  {t('ai.emptyHint')}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    maxWidth: 640,
                    margin: '0 auto',
                  }}
                >
                  {suggestionChips.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setDraft(suggestion);
                        composerRef.current?.focus();
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <p className="text-muted" style={{ marginTop: 12 }}>
                  {t('ai.emptyE2EHint')}
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isMine = message.role === 'user';
                const isTool = message.role === 'tool';
                const isAssistant = message.role === 'assistant';
                const citations = isAssistant ? (citationsByAssistantId.get(message.id) ?? []) : [];
                const ticTacToe =
                  isTool && message.toolName === 'play_tictactoe'
                    ? parseTicTacToeToolContent(message.content)
                    : null;
                const toolMessageContent = isTool
                  ? `${t('ai.toolResultPrefix')}\n${formatToolMessageContent(message.toolName, message.content)}`
                  : message.content;
                return (
                  <div
                    key={message.id}
                    className={`chat-bubble-row ${
                      isMine ? 'chat-bubble-row-mine' : 'chat-bubble-row-theirs'
                    }`}
                  >
                    <div className="chat-bubble-stack">
                      <div
                        className={`chat-bubble ${
                          isMine
                            ? 'chat-bubble-mine'
                            : isTool
                              ? 'chat-bubble-tool'
                              : 'chat-bubble-theirs'
                        }`}
                      >
                        {ticTacToe ? (
                          <div className="tic-tac-toe-tool">
                            <p className="chat-bubble-content">{t('ai.tictactoeBoard')}</p>
                            <TicTacToeBoard board={ticTacToe.board} />
                            <pre className="tic-tac-toe-visual">{ticTacToe.boardVisual}</pre>
                          </div>
                        ) : (
                          <p className="chat-bubble-content">
                            {isTool ? toolMessageContent : message.content}
                          </p>
                        )}
                      </div>
                      {citations.length > 0 && (
                        <div className="ai-citations" aria-label={t('ai.citationsAriaLabel')}>
                          {citations.map((citation) => (
                            <span
                              key={citation.id}
                              className="ai-citation"
                              title={citation.title}
                            >
                              {citation.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {isThinking && (
              <p className="text-muted ai-thinking-indicator" aria-live="polite">
                {t('ai.thinking')}
              </p>
            )}
            {toolRunningStatus && (
              <p className="text-muted ai-run-status" aria-live="polite">
                {toolRunningStatus}
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-composer" onSubmit={(event) => void handleSubmit(event)}>
            <textarea
              ref={composerRef}
              className="chat-input"
              rows={2}
              value={draft}
              placeholder={t('ai.inputPlaceholder')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={isSending || !draft.trim()}>
              {isSending ? t('ai.actions.sending') : t('ai.actions.send')}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
