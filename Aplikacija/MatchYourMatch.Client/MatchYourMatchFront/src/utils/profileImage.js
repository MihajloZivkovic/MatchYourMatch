export function getProfileImageUrl(profilePicture) {
  const value = typeof profilePicture === 'string' ? profilePicture.trim() : '';
  if (!value) return null;
  if (/^(https?:|data:image\/|blob:)/i.test(value)) return value;

  const apiBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5166' : ''))
    .replace(/\/$/, '');
  if (value.startsWith('/')) return `${apiBase}${value}`;
  return `${apiBase}/${value}`;
}
