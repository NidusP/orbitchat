'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, AiConversation, AiMessage, AiSseEvent, AiToolCall } from '@orbitchat/shared-types';
import { parseTicTacToeToolContent, TicTacToeBoard } from '@/components/tic-tac-toe-board';
import { useAuth } from '@/contexts/auth-context';
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
import {
  buildCitationsByAssistantMessage,
  countToolOutputItems,
  formatAiError,
  formatToolMessageContent,
} from '@/lib/ai-agent-ui';

const AI_SUGGESTION_CHIPS = [
  '帮我记一下我喜欢喝燕麦拿铁',
  '我最近发了什么帖子？',
  '帮我写一条动态，主题是周末放松',
  '我们来玩井字棋',
] as const;

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

function getConversationTitle(conversation: AiConversation, agent: Agent | undefined): string {
  return conversation.title ?? `${agent?.name ?? '小轨'} 对话`;
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

function formatCaughtAiError(err: unknown): string {
  if (err instanceof ApiError) {
    return formatAiError(err.code, err.message);
  }
  return '发送失败，请稍后重试。';
}

function describeToolCall(toolCall: AiToolCall): string {
  const input =
    typeof toolCall.input === 'object' && toolCall.input !== null ? toolCall.input : {};

  switch (toolCall.toolName) {
    case 'send_dm': {
      const targetUsername =
        'targetUsername' in input && typeof input.targetUsername === 'string'
          ? input.targetUsername
          : '未知用户';
      const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
      return `发送给 @${targetUsername}${content ? `：${content}` : ''}`;
    }
    case 'create_post': {
      const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
      return content ? `动态内容：${content}` : '将发布一条新动态';
    }
    case 'follow_user':
    case 'unfollow_user': {
      const targetUsername =
        'targetUsername' in input && typeof input.targetUsername === 'string'
          ? input.targetUsername
          : '未知用户';
      const action = toolCall.toolName === 'follow_user' ? '关注' : '取消关注';
      return `${action} @${targetUsername}`;
    }
    case 'remember_fact': {
      const kind = 'kind' in input && typeof input.kind === 'string' ? input.kind : '偏好';
      const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
      return `记住${kind}：${content}`;
    }
    default:
      return `操作：${toolCall.toolName}`;
  }
}

function getToolCallApprovalTitle(toolCall: AiToolCall): string {
  switch (toolCall.toolName) {
    case 'send_dm':
      return '小轨想帮你发送私信，是否同意？';
    case 'create_post':
      return '小轨想帮你发布动态，是否同意？';
    case 'follow_user':
      return '小轨想帮你关注用户，是否同意？';
    case 'unfollow_user':
      return '小轨想帮你取消关注，是否同意？';
    case 'remember_fact':
      return '小轨想记住这条偏好，是否同意？';
    default:
      return '小轨想帮你执行一个站内操作，是否同意？';
  }
}

function describeRunningTool(toolName: string): string {
  switch (toolName) {
    case 'search_contact':
      return '小轨正在查找联系人…';
    case 'get_my_profile':
      return '小轨正在读取你的资料…';
    case 'list_my_recent_posts':
      return '小轨正在读取你最近的动态…';
    case 'search_my_posts':
      return '小轨正在搜索你的动态…';
    case 'search_help_docs':
      return '小轨正在查询帮助资料…';
    case 'get_user_profile':
      return '小轨正在读取对方资料…';
    case 'list_user_recent_posts':
      return '小轨正在读取对方动态…';
    case 'play_tictactoe':
      return '小轨正在更新井字棋棋局…';
    case 'send_dm':
      return '小轨正在准备私信…';
    case 'create_post':
      return '小轨正在准备动态…';
    case 'follow_user':
      return '小轨正在准备关注操作…';
    case 'unfollow_user':
      return '小轨正在准备取消关注…';
    case 'remember_fact':
      return '小轨正在准备记忆…';
    default:
      return `小轨正在执行 ${toolName}…`;
  }
}

function executedToolMessage(toolCall: AiToolCall): string {
  switch (toolCall.toolName) {
    case 'send_dm':
      return '私信发送成功。';
    case 'create_post':
      return '动态发布成功。';
    case 'follow_user':
      return '已完成关注。';
    case 'unfollow_user':
      return '已取消关注。';
    case 'remember_fact':
      return '偏好已记住。';
    case 'search_my_posts':
      return `搜索你的帖子：找到 ${countToolOutputItems(toolCall.output)} 条结果`;
    case 'search_help_docs':
      return `搜索帮助文档：找到 ${countToolOutputItems(toolCall.output)} 条结果`;
    case 'list_my_recent_posts':
      return `最近帖子：共 ${countToolOutputItems(toolCall.output)} 条`;
    default:
      return '操作已执行完成。';
  }
}

export default function AiPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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
      setError(err instanceof ApiError ? err.message : '加载小轨页面失败，请稍后重试。');
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

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
          setError(err instanceof ApiError ? err.message : '加载对话失败，请稍后重试。');
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedConversationId]);

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
      setError(err instanceof ApiError ? err.message : '创建对话失败，请稍后重试。');
    } finally {
      setIsCreating(false);
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (selectedConversationId) {
      return selectedConversationId;
    }
    if (!selectedAgentId) {
      setError('请先选择一个助手。');
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
      setToolRunningStatus(describeRunningTool(event.payload.toolName));
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
              content: executedToolMessage(updated),
            }),
          ])
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `操作失败：${action === 'approve' ? '同意' : '拒绝'}请求未完成。`);
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
      setError(formatCaughtAiError(err));
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
        <p className="text-muted">加载中…</p>
      </main>
    );
  }

  return (
    <main className="main-wide chat-page">
      <header className="page-header section-header">
        <div>
          <h1>小轨</h1>
          <p className="text-muted">
            你的站内助手 · 能聊天、查资料、记偏好、帮你发帖和发私信
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
            <Link href="/ai/memories">管理小轨记忆</Link>
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
                {agent.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selectedAgentId || isCreating}
            onClick={() => void handleNewChat()}
          >
            {isCreating ? '创建中…' : '新建对话'}
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
          <h2 className="section-title">对话记录</h2>
          {conversations.length === 0 ? (
            <p className="text-muted">还没有对话，来和小轨聊聊吧。</p>
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
                    <span>{getConversationTitle(conversation, agent)}</span>
                    <small>{agent?.name ?? '小轨'}</small>
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
                轨
              </div>
              <div style={{ display: 'grid', gap: 2 }}>
                <strong>小轨</strong>
                <span>你的站内助手 · 能聊天、查资料、记偏好、帮你发帖和发私信</span>
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
                        <strong>{getToolCallApprovalTitle(toolCall)}</strong>
                        <p>{describeToolCall(toolCall)}</p>
                        {toolCall.toolName === 'remember_fact' && (
                          <p className="ai-tool-call-helper">
                            确认后小轨会在之后的对话中记住这条信息。{' '}
                            <Link href="/ai/memories">管理小轨记忆</Link>
                          </p>
                        )}
                      </div>
                      <div className="ai-tool-call-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleToolCallAction(toolCall.id, 'approve')}
                        >
                          同意
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleToolCallAction(toolCall.id, 'reject')}
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>你好，我是小轨 👋 想先从哪件事开始？</p>
                <p className="text-muted" style={{ marginBottom: 12 }}>
                  点一下这些建议会自动填入输入框。
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
                  {AI_SUGGESTION_CHIPS.map((suggestion) => (
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
                  也可以输入 <code>[e2e:tictactoe]</code> 触发测试棋局。
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
                  ? `小轨执行结果\n${formatToolMessageContent(message.toolName, message.content)}`
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
                            <p className="chat-bubble-content">井字棋棋盘</p>
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
                        <div className="ai-citations" aria-label="引用来源">
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
                小轨正在思考…
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
              placeholder="想和小轨聊点什么？"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={isSending || !draft.trim()}>
              {isSending ? '发送中…' : '发送'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
