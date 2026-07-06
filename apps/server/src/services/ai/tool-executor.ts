import { searchUsers } from '../follow-service';
import type { AgentToolCallResult, LlmMessage } from '../../lib/agent-runtime/types';
import { createPendingSendDmToolCall } from './tool-call-service';

function extractContactQuery(content: string): string | null {
  const patterns = [
    /search_contact\s*[:：]\s*(.+)$/i,
    /search\s+(?:contact|user)\s+(.+)$/i,
    /找(?:联系人|用户)\s*[:：]?\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    const query = match?.[1]?.trim();
    if (query) {
      return query;
    }
  }

  return null;
}

function extractSendDm(content: string): { targetQuery: string; message: string } | null {
  const patterns = [
    /send_dm\s+to\s+@?([a-zA-Z0-9_]+)\s*[:：]\s*(.+)$/i,
    /send\s+dm\s+to\s+@?([a-zA-Z0-9_]+)\s*[:：]\s*(.+)$/i,
    /给\s*@?([a-zA-Z0-9_]+)\s*发消息\s*[:：]\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    const targetQuery = match?.[1]?.trim();
    const message = match?.[2]?.trim();
    if (targetQuery && message) {
      return { targetQuery, message };
    }
  }

  return null;
}

export async function runReadonlyTools(
  content: string,
  context?: { conversationId: string; userId: string }
): Promise<{
  toolMessages: LlmMessage[];
  toolCalls: AgentToolCallResult[];
}> {
  const sendDm = extractSendDm(content);
  if (sendDm && context) {
    const candidates = await searchUsers(sendDm.targetQuery, { limit: 1 });
    const target = candidates.items[0];

    if (!target) {
      return {
        toolMessages: [
          {
            role: 'tool',
            content: `send_dm could not find target user "${sendDm.targetQuery}".`,
          },
        ],
        toolCalls: [
          {
            toolName: 'send_dm',
            input: { targetQuery: sendDm.targetQuery, content: sendDm.message },
            output: { status: 'target_not_found' },
          },
        ],
      };
    }

    const toolCall = await createPendingSendDmToolCall({
      conversationId: context.conversationId,
      userId: context.userId,
      targetUserId: target.id,
      targetUsername: target.username,
      content: sendDm.message,
    });

    return {
      toolMessages: [
        {
          role: 'tool',
          content: `send_dm pending confirmation: ${JSON.stringify(toolCall)}`,
        },
      ],
      toolCalls: [
        {
          toolName: 'send_dm',
          input: toolCall.input,
          output: { toolCall },
        },
      ],
    };
  }

  const contactQuery = extractContactQuery(content);
  if (!contactQuery) {
    return { toolMessages: [], toolCalls: [] };
  }

  const result = await searchUsers(contactQuery, { limit: 5 });
  const output = {
    items: result.items,
  };

  return {
    toolMessages: [
      {
        role: 'tool',
        content: `search_contact result for "${contactQuery}": ${JSON.stringify(output)}`,
      },
    ],
    toolCalls: [
      {
        toolName: 'search_contact',
        input: { query: contactQuery },
        output,
      },
    ],
  };
}
