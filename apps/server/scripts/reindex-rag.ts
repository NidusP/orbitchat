/**
 * Re-index all RAG knowledge chunks (dev recovery).
 *
 * Usage (from apps/server):
 *   bun scripts/reindex-rag.ts
 */
import { isNull } from 'drizzle-orm';
import { db } from '../src/db';
import { posts } from '../src/db/schema/posts';
import { env } from '../src/env';
import { ensureHelpDocsIndexed, indexPostChunk } from '../src/services/ai/rag-service';

const BATCH_SIZE = 50;

async function reindexAllActivePosts(): Promise<void> {
  const activePosts = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      content: posts.content,
    })
    .from(posts)
    .where(isNull(posts.deletedAt));

  console.log(`Re-indexing ${activePosts.length} active posts...`);

  for (let offset = 0; offset < activePosts.length; offset += BATCH_SIZE) {
    const batch = activePosts.slice(offset, offset + BATCH_SIZE);
    await Promise.all(
      batch.map((post) => indexPostChunk(post.id, post.authorId, post.content))
    );
    console.log(
      `  processed ${Math.min(offset + BATCH_SIZE, activePosts.length)} / ${activePosts.length}`
    );
  }
}

async function main(): Promise<void> {
  if (!env.RAG_ENABLED) {
    console.log('RAG_ENABLED is false; nothing to re-index.');
    return;
  }

  await reindexAllActivePosts();
  await ensureHelpDocsIndexed();
  console.log('RAG re-index complete.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
