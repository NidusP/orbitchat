import type {
  LoginRequest,
  LoginResponse,
  LogoutAllResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationResponse,
  RevokeSessionResponse,
  SessionListResponse,
  TrustSessionRequest,
  TrustSessionResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from '@orbitchat/shared-types';
import { apiRequest, setAccessToken } from './client';

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/api/v1/auth/register', {
    method: 'POST',
    body,
  });
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const data = await apiRequest<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body,
  });

  setAccessToken(data.accessToken);
  return data;
}

export async function refresh(): Promise<RefreshResponse> {
  const data = await apiRequest<RefreshResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    skipAuthRetry: true,
  });

  setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<LogoutResponse> {
  const data = await apiRequest<LogoutResponse>('/api/v1/auth/logout', {
    method: 'DELETE',
  });

  setAccessToken(null);
  return data;
}

export async function listSessions(): Promise<SessionListResponse> {
  return apiRequest<SessionListResponse>('/api/v1/auth/sessions');
}

export async function trustSession(body: TrustSessionRequest): Promise<TrustSessionResponse> {
  return apiRequest<TrustSessionResponse>('/api/v1/auth/sessions/trust', {
    method: 'POST',
    body,
  });
}

export async function revokeSession(sessionId: string): Promise<RevokeSessionResponse> {
  return apiRequest<RevokeSessionResponse>(`/api/v1/auth/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function logoutAll(): Promise<LogoutAllResponse> {
  return apiRequest<LogoutAllResponse>('/api/v1/auth/logout-all', {
    method: 'POST',
  });
}

export async function verifyEmail(body: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  return apiRequest<VerifyEmailResponse>('/api/v1/auth/verify-email', {
    method: 'POST',
    body,
    skipAuthRetry: true,
  });
}

export async function resendVerification(): Promise<ResendVerificationResponse> {
  return apiRequest<ResendVerificationResponse>('/api/v1/auth/resend-verification', {
    method: 'POST',
  });
}
