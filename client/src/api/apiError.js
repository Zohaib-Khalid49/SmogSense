/**
 * Custom error class for backend API errors.
 *
 * Carries the backend error code (e.g. INVALID_COORDINATES, NO_DATA)
 * so the UI can map it to a user-friendly message.
 *
 * @see Backend-Client-Integration.md §5 for the code → message map
 */
export class ApiError extends Error {
  /**
   * @param {string} message - developer-facing message
   * @param {string} code - backend error code (e.g. 'NO_DATA', 'INVALID_COORDINATES')
   * @param {number} [httpStatus=0] - HTTP status code (0 for network errors)
   */
  constructor(message, code = 'UNKNOWN', httpStatus = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

/**
 * User-facing messages keyed by backend error code.
 * Used by UI components to show helpful text instead of raw codes.
 */
export const ERROR_MESSAGES = {
  INVALID_COORDINATES:
    'SmogSense covers Lahore only — showing central Lahore instead.',
  NO_DATA: 'No air quality readings yet. Check back shortly.',
  INVALID_PARAMS: 'Something went wrong — please retry.',
  VALIDATION_ERROR: 'Something went wrong — please retry.',
  INVALID_ID: 'That item no longer exists.',
  NOT_FOUND: 'That item no longer exists.',
  NETWORK_ERROR: "Can't reach SmogSense. Check your connection.",
  TIMEOUT: "Can't reach SmogSense. Check your connection.",
  UNKNOWN: 'Something unexpected happened. Please retry.',
}

/**
 * Get a user-friendly message for an error.
 * Works with ApiError instances and regular Errors.
 *
 * @param {Error|ApiError} err
 * @returns {string}
 */
export function getUserMessage(err) {
  if (err instanceof ApiError && err.code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[err.code]
  }
  return ERROR_MESSAGES.NETWORK_ERROR
}
