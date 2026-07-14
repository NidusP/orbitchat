/**
 * Shared Types - API and Domain Model Definitions
 *
 * This package defines all type contracts between frontend and backend.
 * All types here should be frontend-agnostic and backend-agnostic.
 *
 * Structure:
 * - api/     - API request/response types
 * - domain/  - Business domain models
 * - utils/   - Type utilities and guards
 */

export type { ApiResponse, SuccessResponse, ErrorResponse } from './api/response';
export { isErrorResponse, isSuccessResponse } from './api/response';
export type { CursorPage, CursorPageParams } from './api/cursor-pagination';
export {
  clampCursorLimit,
  DEFAULT_CURSOR_LIMIT,
  MAX_CURSOR_LIMIT,
} from './api/cursor-pagination';
export type { PaginatedResponse, PaginationParams } from './api/pagination';
export { calculateOffset, hasNextPage } from './api/pagination';

export type {
  AuthTokens,
  LoginRequest,
  LoginResponse,
  LogoutAllResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  RevokeSessionResponse,
  SessionListResponse,
  TrustSessionRequest,
  TrustSessionResponse,
  VerifyEmailRequest,
  VerifyEmailResponse,
  ResendVerificationResponse,
} from './api/v1/auth';
export type {
  AgentListResponse,
  ApproveAiToolCallResponse,
  AiConversationListResponse,
  AiMessageListResponse,
  AiToolCallListResponse,
  CommentListResponse,
  ConversationListResponse,
  CreateAiConversationRequest,
  CreateAiConversationResponse,
  CreateAiMessageRequest,
  CreateAiMessageResponse,
  CreateUserAgentMemoryRequest,
  CreateUserAgentMemoryResponse,
  DeleteUserAgentMemoryResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  CreateGroupInviteRequest,
  CreateGroupInviteResponse,
  CreateMessageRequest,
  CreateMessageResponse,
  CreatePostRequest,
  CreatePostResponse,
  GetConversationResponse,
  FollowersListResponse,
  FollowingListResponse,
  FollowUserResponse,
  GetPostResponse,
  HomeFeedResponse,
  LikePostResponse,
  MarkConversationReadRequest,
  MarkConversationReadResponse,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
  MessageListResponse,
  MessageEditListResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
  UpdateMessageRequest,
  UpdateMessageResponse,
  AddGroupMembersRequest,
  GroupInviteListResponse,
  GroupInvitePreviewResponse,
  GroupMemberListResponse,
  TransferGroupOwnerRequest,
  UpdateGroupConversationRequest,
  UpdateGroupMemberRoleRequest,
  RejectAiToolCallResponse,
  UnlikePostResponse,
  UpdatePostRequest,
  UpdatePostResponse,
  UserPostsResponse,
  UserSearchResponse,
  UserAgentMemoryListResponse,
  UnfollowUserResponse,
} from './api/v1';
export type {
  CreateUploadRequest,
  CreateUploadResponse,
  GetMediaParams,
} from './api/v1/uploads';
export type {
  GetProfileResponse,
  GetUserResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  UserWithProfile,
} from './api/v1/users';

export type { Comment, CommentAuthorSummary, CommentWithAuthor } from './domain/comment';
export type {
  Agent,
  AiToolCall,
  AiToolCallStatus,
  AiConversation,
  AiMessage,
  AiMessageDeltaPayload,
  AiMessageDonePayload,
  AiMessageRole,
  AiSseErrorPayload,
  AiSseEvent,
  AiSseEventType,
  AiSsePayloadByType,
  AiToolCallPayload,
  UserAgentMemory,
  UserAgentMemoryKind,
  UserAgentMemorySource,
} from './domain/ai';
export type {
  ChatWsPayloadByType,
  ChatWsType,
  ConnectionMeta,
  ConnectionReadyPayload,
  Conversation,
  ConversationParticipant,
  ConversationType,
  GroupInvite,
  GroupInvitePreview,
  GroupMember,
  GroupMemberRole,
  MemberJoinedPayload,
  MemberLeftPayload,
  Message,
  MessageAckPayload,
  MessageEditRecord,
  MessageNewPayload,
  MessageReadPayload,
  MessageRecall,
  MessageRecalledPayload,
  TypingPayload,
  WsErrorPayload,
  WsMessage,
} from './domain/conversation';
export type { Follow, UserSearchResult } from './domain/follow';
export type {
  InteractionNotification,
  InteractionNotificationCommentPreview,
  InteractionNotificationMessagePreview,
  InteractionNotificationPostPreview,
  InteractionNotificationType,
} from './domain/notification';
export type { Post, PostAuthorSummary, PostWithAuthor } from './domain/post';
export type {
  UploadPurpose,
  UploadStatus,
  UploadSummary,
  PostMediaItem,
} from './domain/upload';
export type { ClientPlatform } from './domain/client';
export { CLIENT_PLATFORMS, isClientPlatform } from './domain/client';
export type { Profile } from './domain/profile';
export type { UserSession } from './domain/session';
export type { User } from './domain/user';

export { isClientPlatform as isValidClientPlatform } from './utils/guards';
