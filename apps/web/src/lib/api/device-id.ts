const DEVICE_ID_KEY = 'orbitchat_device_id';

function generateDeviceId(): string {
  return crypto.randomUUID();
}

/**
 * Returns a stable device ID for this browser, persisted in localStorage.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return '00000000-0000-0000-0000-000000000000';
  }

  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const deviceId = generateDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}
