/**
 * User domain model (API DTO — no password fields).
 */
export interface User {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
