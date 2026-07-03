import type { CursorPageParams, HomeFeedResponse } from '@orbitchat/shared-types';
import { apiRequest } from './client';

function buildQuery(params: CursorPageParams): string {
  const search = new URLSearchParams();
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getHomeFeed(params: CursorPageParams = {}): Promise<HomeFeedResponse> {
  return apiRequest<HomeFeedResponse>(`/api/v1/feed/home${buildQuery(params)}`);
}
