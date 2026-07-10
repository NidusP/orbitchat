import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { db, type Database } from '../../db';
import { knowledgeChunks } from '../../db/schema/knowledge-chunks';
import { env } from '../../env';
import { getPostgresErrorCode, isUndefinedTable } from '../../lib/postgres-errors';
import {
  createEmbeddingProvider,
  type EmbeddingProvider,
} from '../../lib/rag/embedding-provider';

function getDefaultEmbeddingProvider(): EmbeddingProvider {
  return createEmbeddingProvider({
    llmE2eMock: env.LLM_E2E_MOCK,
    llmBaseUrl: env.LLM_BASE_URL,
    llmApiKey: env.LLM_API_KEY,
    llmTimeoutMs: env.LLM_TIMEOUT_MS,
    embeddingModel: env.EMBEDDING_MODEL,
    embeddingDimensions: env.EMBEDDING_DIMENSIONS,
  });
}
const POST_CHUNK_MAX_CHARS = 2000;
const DOC_CHUNK_MAX_CHARS = 4000;
const DEFAULT_SEARCH_LIMIT = 5;
const HELP_DOC_FILES = ['product.md', 'api-spec.md'] as const;

export type RagPostSearchItem = {
  postId: string;
  text: string;
  score: number;
};

export type RagHelpSearchItem = {
  sourceId: string;
  text: string;
  score: number;
};

export type RagSearchResult<TItem> = {
  items: TItem[];
};

type KnowledgeSourceType = 'post' | 'doc';

type StoredChunk = {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  text: string;
  ownerUserId: string | null;
  embedding: number[] | null;
};

type SearchRow = {
  source_id: string;
  text: string;
  score: number;
};

export interface RagChunkStore {
  upsertChunk(chunk: StoredChunk): Promise<void>;
  deleteChunk(sourceType: KnowledgeSourceType, sourceId: string): Promise<void>;
  searchByVector(input: {
    sourceType: KnowledgeSourceType;
    ownerUserId: string | null;
    queryEmbedding: number[];
    limit: number;
  }): Promise<SearchRow[]>;
  searchByText(input: {
    sourceType: KnowledgeSourceType;
    ownerUserId: string | null;
    query: string;
    limit: number;
  }): Promise<SearchRow[]>;
}

export interface RagServiceDeps {
  db?: Database;
  embeddingProvider?: EmbeddingProvider;
  chunkStore?: RagChunkStore;
  readFileFn?: (filePath: string) => Promise<string>;
  ragEnabled?: boolean;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(0, maxChars);
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

function createPgChunkStore(database: Database): RagChunkStore {
  return {
    async upsertChunk(chunk) {
      const embeddingLiteral = chunk.embedding ? toVectorLiteral(chunk.embedding) : null;

      await database.execute(sql`
        INSERT INTO knowledge_chunks (source_type, source_id, text, owner_user_id, embedding)
        VALUES (
          ${chunk.sourceType},
          ${chunk.sourceId},
          ${chunk.text},
          ${chunk.ownerUserId},
          ${embeddingLiteral}::vector
        )
        ON CONFLICT (source_type, source_id) DO UPDATE SET
          text = EXCLUDED.text,
          owner_user_id = EXCLUDED.owner_user_id,
          embedding = EXCLUDED.embedding,
          updated_at = now()
      `);
    },

    async deleteChunk(sourceType, sourceId) {
      await database
        .delete(knowledgeChunks)
        .where(
          and(eq(knowledgeChunks.sourceType, sourceType), eq(knowledgeChunks.sourceId, sourceId))
        );
    },

    async searchByVector({ sourceType, ownerUserId, queryEmbedding, limit }) {
      const embeddingLiteral = toVectorLiteral(queryEmbedding);
      const ownerFilter =
        ownerUserId === null
          ? sql`owner_user_id IS NULL`
          : sql`owner_user_id = ${ownerUserId}::uuid`;

      const result = await database.execute(sql`
        SELECT
          source_id,
          text,
          1 - (embedding <=> ${embeddingLiteral}::vector) AS score
        FROM knowledge_chunks
        WHERE source_type = ${sourceType}
          AND ${ownerFilter}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingLiteral}::vector
        LIMIT ${limit}
      `);

      return result as unknown as SearchRow[];
    },

    async searchByText({ sourceType, ownerUserId, query, limit }) {
      const pattern = `%${query}%`;
      const ownerFilter =
        ownerUserId === null
          ? sql`owner_user_id IS NULL`
          : sql`owner_user_id = ${ownerUserId}::uuid`;

      const result = await database.execute(sql`
        SELECT
          source_id,
          text,
          0.5::float AS score
        FROM knowledge_chunks
        WHERE source_type = ${sourceType}
          AND ${ownerFilter}
          AND text ILIKE ${pattern}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `);

      return result as unknown as SearchRow[];
    },
  };
}

export function createInMemoryChunkStore(): RagChunkStore & { chunks: StoredChunk[] } {
  const chunks: StoredChunk[] = [];

  return {
    chunks,
    async upsertChunk(chunk) {
      const existingIndex = chunks.findIndex(
        (item) => item.sourceType === chunk.sourceType && item.sourceId === chunk.sourceId
      );

      if (existingIndex >= 0) {
        chunks[existingIndex] = chunk;
        return;
      }

      chunks.push(chunk);
    },

    async deleteChunk(sourceType, sourceId) {
      const index = chunks.findIndex(
        (item) => item.sourceType === sourceType && item.sourceId === sourceId
      );
      if (index >= 0) {
        chunks.splice(index, 1);
      }
    },

    async searchByVector({ sourceType, ownerUserId, queryEmbedding, limit }) {
      return chunks
        .filter(
          (chunk) =>
            chunk.sourceType === sourceType &&
            chunk.ownerUserId === ownerUserId &&
            chunk.embedding !== null
        )
        .map((chunk) => ({
          source_id: chunk.sourceId,
          text: chunk.text,
          score: cosineSimilarity(queryEmbedding, chunk.embedding ?? []),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
    },

    async searchByText({ sourceType, ownerUserId, query, limit }) {
      const needle = query.toLowerCase();

      return chunks
        .filter(
          (chunk) =>
            chunk.sourceType === sourceType &&
            chunk.ownerUserId === ownerUserId &&
            chunk.text.toLowerCase().includes(needle)
        )
        .map((chunk) => ({
          source_id: chunk.sourceId,
          text: chunk.text,
          score: 0.5,
        }))
        .slice(0, limit);
    },
  };
}

function docsFilePath(filename: string): string {
  return path.join(process.cwd(), '../../docs', filename);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.max(1, limit);
}

export function createRagService(deps: RagServiceDeps = {}) {
  const database = deps.db ?? db;
  const embeddingProvider = deps.embeddingProvider ?? getDefaultEmbeddingProvider();
  const chunkStore = deps.chunkStore ?? createPgChunkStore(database);
  const readFileFn = deps.readFileFn ?? ((filePath: string) => readFile(filePath, 'utf8'));
  const ragEnabled = deps.ragEnabled ?? env.RAG_ENABLED;

  async function searchChunks<TItem>(
    input: {
      sourceType: KnowledgeSourceType;
      ownerUserId: string | null;
      query: string;
      limit?: number;
    },
    mapRow: (row: SearchRow) => TItem
  ): Promise<RagSearchResult<TItem>> {
    const limit = clampLimit(input.limit);

    try {
      const queryEmbedding = await embeddingProvider.embed(input.query);
      const rows = await chunkStore.searchByVector({
        sourceType: input.sourceType,
        ownerUserId: input.ownerUserId,
        queryEmbedding,
        limit,
      });

      return {
        items: rows.map(mapRow),
      };
    } catch (error) {
      if (isUndefinedTable(error)) {
        return { items: [] };
      }

      const code = getPostgresErrorCode(error);
      const missingVectorSetup = code === '42703';

      if (!missingVectorSetup) {
        console.error('[rag] vector search failed, falling back to text search', {
          sourceType: input.sourceType,
          error,
        });
      }

      try {
        const rows = await chunkStore.searchByText({
          sourceType: input.sourceType,
          ownerUserId: input.ownerUserId,
          query: input.query,
          limit,
        });

        return {
          items: rows.map(mapRow),
        };
      } catch (fallbackError) {
        if (isUndefinedTable(fallbackError)) {
          return { items: [] };
        }
        throw fallbackError;
      }
    }
  }

  async function indexPostChunk(postId: string, authorId: string, content: string): Promise<void> {
    if (!ragEnabled) {
      return;
    }

    const text = truncateText(content, POST_CHUNK_MAX_CHARS);

    try {
      const embedding = await embeddingProvider.embed(text);
      await chunkStore.upsertChunk({
        sourceType: 'post',
        sourceId: postId,
        text,
        ownerUserId: authorId,
        embedding,
      });
    } catch (error) {
      if (isUndefinedTable(error)) {
        return;
      }
      console.error('[rag] indexPostChunk failed', { postId, error });
    }
  }

  async function removePostChunk(postId: string): Promise<void> {
    if (!ragEnabled) {
      return;
    }

    await chunkStore.deleteChunk('post', postId);
  }

  async function searchMyPosts(
    userId: string,
    query: string,
    options: { limit?: number } = {}
  ): Promise<RagSearchResult<RagPostSearchItem>> {
    const result = await searchChunks(
      {
        sourceType: 'post',
        ownerUserId: userId,
        query,
        limit: options.limit,
      },
      (row) => ({
        postId: row.source_id,
        text: row.text,
        score: Number(row.score),
      })
    );

    return result;
  }

  async function searchHelpDocs(
    query: string,
    options: { limit?: number } = {}
  ): Promise<RagSearchResult<RagHelpSearchItem>> {
    const result = await searchChunks(
      {
        sourceType: 'doc',
        ownerUserId: null,
        query,
        limit: options.limit,
      },
      (row) => ({
        sourceId: row.source_id,
        text: row.text,
        score: Number(row.score),
      })
    );

    return result;
  }

  async function ensureHelpDocsIndexed(): Promise<void> {
    if (!ragEnabled) {
      return;
    }

    for (const filename of HELP_DOC_FILES) {
      const filePath = docsFilePath(filename);

      try {
        const raw = await readFileFn(filePath);
        const text = truncateText(raw, DOC_CHUNK_MAX_CHARS);
        const embedding = await embeddingProvider.embed(text);

        await chunkStore.upsertChunk({
          sourceType: 'doc',
          sourceId: filename,
          text,
          ownerUserId: null,
          embedding,
        });
      } catch (error) {
        if (isUndefinedTable(error)) {
          return;
        }
        console.error('[rag] ensureHelpDocsIndexed failed', { filename, error });
      }
    }
  }

  return {
    indexPostChunk,
    removePostChunk,
    searchMyPosts,
    searchHelpDocs,
    ensureHelpDocsIndexed,
  };
}

const defaultRagService = createRagService();

export const indexPostChunk = defaultRagService.indexPostChunk;
export const removePostChunk = defaultRagService.removePostChunk;
export const searchMyPosts = defaultRagService.searchMyPosts;
export const searchHelpDocs = defaultRagService.searchHelpDocs;
export const ensureHelpDocsIndexed = defaultRagService.ensureHelpDocsIndexed;
