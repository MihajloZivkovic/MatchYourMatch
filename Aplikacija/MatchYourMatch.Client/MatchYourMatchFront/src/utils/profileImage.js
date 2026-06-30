export function getProfileImageUrl(profilePicture) {
  const value = typeof profilePicture === 'string' ? profilePicture.trim() : '';
  if (!value) return null;
  if (/^(https?:|data:image\/|blob:)/i.test(value)) return value;

  const apiBase = (import.meta.env.VITE_API_BASE_URL || '')
    .replace(/\/$/, '');
  if (value.startsWith('/')) return apiBase ? `${apiBase}${value}` : value;
  return apiBase ? `${apiBase}/${value}` : `/${value}`;
}
