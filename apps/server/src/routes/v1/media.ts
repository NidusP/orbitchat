import { Hono } from 'hono';
import { parseUuidParam } from '../../lib/validation';
import { getCommittedMediaStream } from '../../services/upload-service';

export const mediaRouter = new Hono();

function parseUploadId(rawId: string): string {
  return parseUuidParam(rawId, 'uploadId', 'Invalid upload id');
}

mediaRouter.get('/:uploadId', async (c) => {
  const uploadId = parseUploadId(c.req.param('uploadId'));
  const media = await getCommittedMediaStream(uploadId);

  return new Response(media.body, {
    status: 200,
    headers: {
      'Content-Type': media.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
