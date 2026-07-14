import { env } from '../env';

export function isEmailVerificationEnabled(): boolean {
  return env.EMAIL_VERIFICATION_ENABLED;
}

export function getAppPublicUrl(): string {
  return env.APP_PUBLIC_URL ?? 'http://localhost:3000';
}
