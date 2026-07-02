const AUTH_STORAGE_KEYS = [
  'token',
  'mym_authed',
  'user',
  'currentUser',
  'mym_guest_city',
  'mym_session_return_url',
];
const AUTH_STORAGE_PREFIXES = ['mym_reaction_preset_'];

export function clearAuthSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  AUTH_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
  AUTH_STORAGE_PREFIXES.forEach((prefix) => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key));
  });
  window.dispatchEvent(new Event('tokenChanged'));
}

export function logoutAndRedirect(navigate, landingRoute = '/') {
  clearAuthSession();
  navigate(landingRoute, { replace: true });
}
