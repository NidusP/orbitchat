'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, AiConversation, AiMessage, AiSseEvent, AiToolCall } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
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
  return conversation.title ?? `${agent?.name ?? 'Agent'} chat`;
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

function describeToolCall(toolCall: AiToolCall): string {
  const input =
    typeof toolCall.input === 'object' && toolCall.input !== null ? toolCall.input : {};
  const targetUsername =
    'targetUsername' in input && typeof input.targetUsername === 'string'
      ? input.targetUsername
      : 'unknown';
  const content = 'content' in input && typeof input.content === 'string' ? input.content : '';
  return `Send DM to @${targetUsername}: ${content}`;
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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  );

  const selectedAgent = selectedConversation
    ? agentsById.get(selectedConversation.agentId)
    : agentsById.get(selectedAgentId);

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
      setError(err instanceof ApiError ? err.message : 'Failed to load AI chat.');
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
          setError(err instanceof ApiError ? err.message : 'Failed to load AI messages.');
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
      setError(err instanceof ApiError ? err.message : 'Failed to create AI conversation.');
    } finally {
      setIsCreating(false);
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (selectedConversationId) {
      return selectedConversationId;
    }
    if (!selectedAgentId) {
      setError('Select an agent first.');
      return null;
    }
    const conversation = await createAiConversation({ agentId: selectedAgentId });
    setConversations((current) => [conversation, ...current]);
    setSelectedConversationId(conversation.id);
    return conversation.id;
  }

  function applyAiEvent(event: AiSseEvent, assistantMessageId: string, titleSeed: string) {
    if (event.type === 'tool.call') {
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
      setError(event.payload.message);
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
              content: 'send_dm executed successfully.',
            }),
          ])
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} tool call.`);
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

      await sendAiMessageStream(conversationId, { content }, (aiEvent) => {
        applyAiEvent(aiEvent, localAssistantMessage.id, content);
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send AI message.');
    } finally {
      setIsSending(false);
    }
  }

  if (authLoading || isLoadingPage) {
    return (
      <main className="main-wide">
        <SiteNav />
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="main-wide chat-page">
      <SiteNav />
      <header className="page-header section-header">
        <div>
          <h1>AI Chat</h1>
          <p className="text-muted">Chat with Orbitchat built-in agents.</p>
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
            {isCreating ? 'Creating…' : 'New chat'}
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
          <h2 className="section-title">Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-muted">No AI chats yet.</p>
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
                    <small>{agent?.name ?? 'Agent'}</small>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="chat-panel card">
          <div className="ai-agent-summary">
            <strong>{selectedAgent?.name ?? 'Select an agent'}</strong>
            {selectedAgent && <span>{selectedAgent.description}</span>}
          </div>

          <div className="chat-messages">
            {toolCalls.some((toolCall) => toolCall.status === 'pending') && (
              <div className="ai-tool-call-stack">
                {toolCalls
                  .filter((toolCall) => toolCall.status === 'pending')
                  .map((toolCall) => (
                    <div key={toolCall.id} className="ai-tool-call-card">
                      <div>
                        <strong>Confirm action</strong>
                        <p>{describeToolCall(toolCall)}</p>
                      </div>
                      <div className="ai-tool-call-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void handleToolCallAction(toolCall.id, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleToolCallAction(toolCall.id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p className="text-muted">Ask for a joke, a tic-tac-toe move, or try:</p>
                <p>
                  <code>search_contact: luna</code>
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isMine = message.role === 'user';
                const isTool = message.role === 'tool';
                return (
                  <div
                    key={message.id}
                    className={`chat-bubble-row ${
                      isMine ? 'chat-bubble-row-mine' : 'chat-bubble-row-theirs'
                    }`}
                  >
                    <div
                      className={`chat-bubble ${
                        isMine
                          ? 'chat-bubble-mine'
                          : isTool
                            ? 'chat-bubble-tool'
                            : 'chat-bubble-theirs'
                      }`}
                    >
                      <p className="chat-bubble-content">
                        {isTool ? `Tool ${message.toolName ?? ''}\n${message.content}` : message.content}
                      </p>
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
              placeholder="Ask 小轨 something…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={isSending || !draft.trim()}>
              {isSending ? 'Thinking…' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
