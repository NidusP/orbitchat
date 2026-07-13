interface AvatarPaletteEntry {
  backgroundColor: string;
  textColor: string;
}

const WARM_AVATAR_PALETTE: readonly AvatarPaletteEntry[] = [
  { backgroundColor: '#f5d9d2', textColor: '#7b3f2d' },
  { backgroundColor: '#f7e2c7', textColor: '#7a4b17' },
  { backgroundColor: '#f6edcf', textColor: '#6f5b15' },
  { backgroundColor: '#dceccf', textColor: '#355b2b' },
  { backgroundColor: '#d4ece6', textColor: '#1f5c53' },
  { backgroundColor: '#d9e8f8', textColor: '#2f4f83' },
  { backgroundColor: '#e6ddf7', textColor: '#5a3f84' },
  { backgroundColor: '#f2ddef', textColor: '#7b3b6f' },
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}

function isCjkCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff)
  );
}

function getFirstCharacter(input: string): string {
  for (const char of input) {
    if (char.trim() !== '') {
      return char;
    }
  }
  return '';
}

export function getAvatarInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed === '') {
    return '?';
  }

  const firstChar = getFirstCharacter(trimmed);
  if (firstChar !== '') {
    const firstCodePoint = firstChar.codePointAt(0);
    if (firstCodePoint !== undefined && isCjkCodePoint(firstCodePoint)) {
      return firstChar;
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = getFirstCharacter(words[0]);
    const last = getFirstCharacter(words[words.length - 1]);
    const combined = `${first}${last}`.trim();
    if (combined !== '') {
      return combined.toUpperCase();
    }
  }

  const characters = Array.from(trimmed).filter((char) => char.trim() !== '');
  return characters.slice(0, 2).join('').toUpperCase();
}

export function getAvatarColors(seed?: string): AvatarPaletteEntry {
  if (!seed || seed.trim() === '') {
    return WARM_AVATAR_PALETTE[0];
  }

  const index = hashString(seed) % WARM_AVATAR_PALETTE.length;
  return WARM_AVATAR_PALETTE[index];
}
