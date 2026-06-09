/**
 * Pagination Types
 * 
 * Standard pagination interface for list endpoints.
 */

export interface PaginationParams {
  page: number;      // Page number, starting from 1
  limit: number;     // Items per page, default 20, max 100
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

/**
 * Calculate offset from page and limit
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Check if there is a next page
 */
export function hasNextPage(page: number, limit: number, total: number): boolean {
  return page * limit < total;
}
