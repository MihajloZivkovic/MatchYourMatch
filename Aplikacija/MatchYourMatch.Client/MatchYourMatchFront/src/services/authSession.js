const AUTH_STORAGE_KEYS = ['token', 'mym_authed', 'user', 'currentUser', 'mym_guest_city'];

export function clearAuthSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new Event('tokenChanged'));
}

export function logoutAndRedirect(navigate, landingRoute = '/') {
  clearAuthSession();
  navigate(landingRoute, { replace: true });
}
