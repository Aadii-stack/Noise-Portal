/**
 * ──────────────────────────────────────────────
 *  utils.js — Shared helpers used by every module
 * ──────────────────────────────────────────────
 *
 *  • DOM shortcuts ($ and $$)
 *  • API request wrapper (auto-attaches JWT)
 *  • Toast notification system
 *  • XSS-safe HTML escaping
 */

/* ── API base URL (set via .env or defaults to same origin) ── */
export const API_URL = import.meta.env.VITE_API_URL || '';

/* ── DOM helpers ── */

/** Select a single element (like document.querySelector) */
export const $ = (selector) => document.querySelector(selector);

/** Select all matching elements and return a real Array */
export const $$ = (selector) => Array.from(document.querySelectorAll(selector));

/* ── API Request ── */

/**
 * Wrapper around fetch() that:
 *  1. Automatically sets Content-Type to JSON (unless sending FormData)
 *  2. Attaches the JWT Bearer token from localStorage when available
 *  3. Throws a descriptive Error on non-2xx responses
 *
 * @param {string} path   - API endpoint, e.g. "/api/reports"
 * @param {object} options - Standard fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} Parsed JSON response
 */
export async function request(path, options = {}) {
  const token = localStorage.getItem('noise_portal_token');

  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

/* ── Toast Notifications ── */

/**
 * Show a temporary notification toast at the top-right corner.
 * Auto-hides after ~4 seconds.
 *
 * @param {string} message - Text to display
 * @param {'success'|'error'} type - Visual style
 */
export function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 4200);
}

/* ── HTML Escaping ── */

/**
 * Escape special characters to prevent XSS when inserting
 * user-provided data into innerHTML.
 *
 * @param {string} value - Raw string
 * @returns {string} Safe HTML string
 */
export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
