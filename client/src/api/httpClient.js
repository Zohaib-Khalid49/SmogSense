/**
 * HTTP client for the SmogSense backend.
 *
 * - Joins VITE_API_BASE_URL with the path
 * - 10s AbortController timeout
 * - Unwraps the { success, data, meta } envelope
 * - Throws ApiError on success:false or network failures
 * - Returns { data: null, noData: true } for the NO_DATA case
 *
 * @see Backend-Client-Integration.md §3 (Target Architecture)
 */

import { ApiError } from './apiError'

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const TIMEOUT_MS = 10_000

/**
 * Make a GET request to the backend.
 *
 * @param {string} path - e.g. '/hazard-status'
 * @param {Record<string, string>} [params] - query parameters
 * @returns {Promise<{ data: any, meta?: any, noData: boolean }>}
 * @throws {ApiError}
 */
export async function get(path, params = {}) {
  return request('GET', path, params)
}

/**
 * Make a POST request to the backend.
 *
 * @param {string} path - e.g. '/profiles'
 * @param {any} body - JSON body
 * @returns {Promise<{ data: any, meta?: any, noData: boolean }>}
 * @throws {ApiError}
 */
export async function post(path, body) {
  return request('POST', path, {}, body)
}

/**
 * Make a PATCH request to the backend.
 *
 * @param {string} path - e.g. '/profiles/:id'
 * @param {any} body - JSON body
 * @returns {Promise<{ data: any, meta?: any, noData: boolean }>}
 * @throws {ApiError}
 */
export async function patch(path, body) {
  return request('PATCH', path, {}, body)
}

/**
 * Make a DELETE request to the backend.
 *
 * @param {string} path - e.g. '/profiles/:id'
 * @returns {Promise<{ data: any, meta?: any, noData: boolean }>}
 * @throws {ApiError}
 */
export async function del(path) {
  return request('DELETE', path)
}

/**
 * Core request function. Not exported — use get/post/patch above.
 */
async function request(method, path, params = {}, body = undefined) {
  const url = buildUrl(path, params)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    }

    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)

    // Non-JSON responses (e.g. 502 from a proxy)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new ApiError(
        `Server returned ${res.status} (non-JSON)`,
        'NETWORK_ERROR',
        res.status,
      )
    }

    const envelope = await res.json()

    // Backend error envelope: { success: false, error: { code, message } }
    if (!envelope.success) {
      const err = envelope.error || {}
      const code = err.code || 'UNKNOWN'
      const message = err.message || `Request failed (${res.status})`

      // NO_DATA is a special case — not an error, just empty
      if (code === 'NO_DATA' || envelope.meta?.code === 'NO_DATA') {
        return { data: null, meta: envelope.meta, noData: true }
      }

      throw new ApiError(message, code, res.status)
    }

    // Success envelope: { success: true, data: ..., meta: ... }
    return {
      data: envelope.data ?? null,
      meta: envelope.meta ?? null,
      noData: envelope.data === null || envelope.data === undefined,
    }
  } catch (err) {
    // Re-throw ApiErrors as-is
    if (err instanceof ApiError) throw err

    // AbortController timeout
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out', 'TIMEOUT', 0)
    }

    // Network failure (DNS, offline, refused)
    throw new ApiError(
      err.message || 'Network error',
      'NETWORK_ERROR',
      0,
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build a full URL from base + path + query params.
 */
function buildUrl(path, params = {}) {
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}
