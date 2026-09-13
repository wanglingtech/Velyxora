export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const SUPPORTED_CONTAINERS = [
  'mp4', 'webm', 'mov', 'mkv', 'avi',
  'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
  'pdf', 'docx', 'xlsx', 'pptx', 'csv', 'json'
] as const;
