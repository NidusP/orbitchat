/** Stable key for 1:1 direct conversations: minUuid:maxUuid */
export function buildDirectKey(userA: string, userB: string): string {
  return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}

export function conversationRoomId(conversationId: string): string {
  return `conversation:${conversationId}`;
}
