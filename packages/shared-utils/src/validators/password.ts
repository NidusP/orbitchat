/**
 * Password Validation Utilities
 */

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

export function isValidPassword(password: string, requirements = DEFAULT_PASSWORD_REQUIREMENTS): boolean {
  if (password.length < requirements.minLength) {
    return false;
  }

  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    return false;
  }

  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    return false;
  }

  if (requirements.requireNumbers && !/\d/.test(password)) {
    return false;
  }

  if (requirements.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
    return false;
  }

  return true;
}

export function getPasswordStrength(password: string): 'weak' | 'fair' | 'good' | 'strong' {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'fair';
  if (score <= 4) return 'good';
  return 'strong';
}
