import type { Profile, User, UserSession } from '../../domain';

/** POST /api/v1/auth/register */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterResponse {
  user: User;
  profile: Profile;
}

/** POST /api/v1/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  trustDevice?: boolean;
  deviceName?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

/** Web: refreshToken via httpOnly Cookie; mobile may include refreshToken in body */
export interface LoginResponse extends AuthTokens {
  user: User;
  session: UserSession;
  refreshToken?: string;
}

/** POST /api/v1/auth/refresh */
export interface RefreshResponse extends AuthTokens {
  session: UserSession;
  refreshToken?: string;
}

/** DELETE /api/v1/auth/logout */
export interface LogoutResponse {
  success: true;
}

/** POST /api/v1/auth/logout-all */
export interface LogoutAllResponse {
  revokedCount: number;
}

/** GET /api/v1/auth/sessions */
export interface SessionListResponse {
  sessions: UserSession[];
  currentSessionId: string;
}

/** POST /api/v1/auth/sessions/trust */
export interface TrustSessionRequest {
  trust: boolean;
}

export interface TrustSessionResponse {
  session: UserSession;
}

/** DELETE /api/v1/auth/sessions/:sessionId */
export interface RevokeSessionResponse {
  success: true;
}
