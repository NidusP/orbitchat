import { describe, expect, test } from 'bun:test';
import type { AiMessage } from '@orbitchat/shared-types';
import {
  buildCitationsByAssistantMessage,
  formatAiError,
  formatToolMessageContent,
  parseCitationsFromToolOutput,
} from './ai-agent-ui';

describe('parseCitationsFromToolOutput', () => {
  test('maps search_my_posts hits to citation chips', () => {
    const citations = parseCitationsFromToolOutput('search_my_posts', {
      items: [
        {
          postId: '77777777-7777-4777-8777-777777777777',
          text: 'Travel diary from Kyoto',
          score: 0.9,
        },
      ],
    });

    expect(citations.length).toBe(1);
    expect(citations[0]?.label).toBe('依据：帖子 77777777');
    expect(citations[0]?.title).toBe('Travel diary from Kyoto');
  });

  test('maps search_help_docs hits to doc citations', () => {
    const citations = parseCitationsFromToolOutput('search_help_docs', {
      items: [{ sourceId: 'api-spec.md', text: 'Routes under /api/v1/', score: 0.8 }],
    });

    expect(citations[0]?.label).toBe('依据：api-spec.md 文档');
  });

  test('deduplicates repeated post ids', () => {
    const citations = parseCitationsFromToolOutput('search_my_posts', {
      items: [
        { postId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'a', score: 1 },
        { postId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'b', score: 0.9 },
      ],
    });

    expect(citations.length).toBe(1);
  });

  test('maps list_my_recent_posts items to post citations', () => {
    const citations = parseCitationsFromToolOutput('list_my_recent_posts', {
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', content: 'Weekend hike' }],
    });

    expect(citations.length).toBe(1);
    expect(citations[0]?.label.includes('cccccccc')).toBe(true);
    expect(citations[0]?.title).toBe('Weekend hike');
  });
});

describe('buildCitationsByAssistantMessage', () => {
  test('attaches citations to the next assistant message in the turn', () => {
    const messages: AiMessage[] = [
      {
        id: 'user-1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'search my travel posts',
        toolName: null,
        createdAt: '2026-07-09T10:00:00.000Z',
      },
      {
        id: 'tool-1',
        conversationId: 'conv-1',
        role: 'tool',
        content: JSON.stringify({
          items: [
            {
              postId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              text: 'Weekend travel',
              score: 0.88,
            },
          ],
        }),
        toolName: 'search_my_posts',
        createdAt: '2026-07-09T10:00:01.000Z',
      },
      {
        id: 'assistant-1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'You posted about travel.',
        toolName: null,
        createdAt: '2026-07-09T10:00:02.000Z',
      },
    ];

    const map = buildCitationsByAssistantMessage(messages);
    const assistantCitations = map.get('assistant-1');
    expect(assistantCitations?.length).toBe(1);
    expect(assistantCitations?.[0]?.label.includes('bbbbbbbb')).toBe(true);
  });
});

describe('formatAiError', () => {
  test('returns friendly Chinese copy for AI_BUSY with retry hint', () => {
    const busyMessage = formatAiError('AI_BUSY', 'Too many concurrent runs');
    expect(busyMessage.includes('小轨正忙')).toBe(true);
    expect(busyMessage.includes('稍后重试')).toBe(true);
  });

  test('falls back to server message for unknown codes', () => {
    expect(formatAiError('VALIDATION_ERROR', 'Invalid input')).toBe('Invalid input');
  });

  test('returns friendly copy for LLM and stream failures', () => {
    expect(formatAiError('LLM_UNAVAILABLE', 'upstream down').includes('模型服务暂不可用')).toBe(
      true
    );
    expect(formatAiError('AI_STREAM_FAILED', 'stream ended').includes('连接中断')).toBe(true);
  });
});

describe('formatToolMessageContent', () => {
  test('summarizes search_my_posts hit count', () => {
    const content = formatToolMessageContent(
      'search_my_posts',
      JSON.stringify({ items: [{ postId: 'x', text: 'a', score: 1 }] })
    );

    expect(content).toBe('搜索你的帖子：找到 1 条结果');
  });

  test('summarizes list_my_recent_posts count', () => {
    const content = formatToolMessageContent(
      'list_my_recent_posts',
      JSON.stringify({ items: [{ id: 'post-1', content: 'Hello' }] })
    );

    expect(content).toBe('最近帖子：共 1 条');
  });
});
