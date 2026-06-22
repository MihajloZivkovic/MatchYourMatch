import { clearAuthSession } from './authSession';

const SESSION_EVENT = 'mym:session-expired';
const EXCLUDED_PATHS = ['/api/auth/', '/api/account/reactivate'];
let expired = false;
let installed = false;
let expiryTimer = null;

export const isSessionExpired = () => expired;
export const getSessionReturnUrl = () => sessionStorage.getItem('mym_session_return_url') || '/app/dashboard';

export function resetSessionExpired() {
  expired = false;
  sessionStorage.removeItem('mym_session_return_url');
}

export function expireSession() {
  if (expired || !localStorage.getItem('token')) return false;
  expired = true;
  const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (returnUrl.startsWith('/app')) sessionStorage.setItem('mym_session_return_url', returnUrl);
  clearAuthSession();
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
  return true;
}

function getRequestUrl(input) {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
}

function isExcluded(url) {
  try {
    const path = new URL(url, window.location.origin).pathname.toLowerCase();
    return EXCLUDED_PATHS.some(value => path.startsWith(value.toLowerCase()));
  } catch {
    return true;
  }
}

function readExpiry(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)).exp * 1000 || null;
  } catch { return null; }
}

function scheduleLocalExpiry() {
  if (expiryTimer) window.clearTimeout(expiryTimer);
  expiryTimer = null;
  const token = localStorage.getItem('token');
  const expiresAt = token && readExpiry(token);
  if (!expiresAt) return;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    expireSession();
    return;
  }
  expiryTimer = window.setTimeout(() => {
    if (localStorage.getItem('token') === token) expireSession();
  }, Math.min(remaining, 2_147_000_000));
}

export function installSessionExpiryInterceptor() {
  if (installed) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const tokenAtRequest = localStorage.getItem('token');
    const response = await originalFetch(input, init);
    const url = getRequestUrl(input);
    if (response.status === 401 && tokenAtRequest && !isExcluded(url)) {
      expireSession();
      // Keep page-level request handlers from replacing the global session message.
      return new Promise(() => {});
    }
    return response;
  };
  window.addEventListener('tokenChanged', scheduleLocalExpiry);
  scheduleLocalExpiry();
}

export { SESSION_EVENT };
