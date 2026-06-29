const ROLE_CLAIMS = [
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  'role',
  'userType',
];

export const GUEST_FALLBACK_CITIES = [
  'Niš',
  'Beograd',
  'Novi Sad',
  'Kragujevac',
  'Subotica',
  'Novi Pazar',
  'Leskovac',
];

export function normalizeCityName(city = '') {
  return String(city)
    .replaceAll('NiÅ¡', 'Niš')
    .replaceAll('Nis', 'Niš')
    .replaceAll('NISH', 'Niš')
    .trim();
}

export function readJwtPayload(token = localStorage.getItem('token')) {
  if (!token) return null;

  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function getSessionRole(token = localStorage.getItem('token')) {
  const payload = readJwtPayload(token);
  if (!payload) return '';
  const rawRole = ROLE_CLAIMS.map((claim) => payload[claim]).find(Boolean) || '';
  return Array.isArray(rawRole) ? rawRole[0] || '' : rawRole;
}

export function isGuestSession(token = localStorage.getItem('token')) {
  return getSessionRole(token).toLowerCase() === 'guest';
}

export function isAdminSession(token = localStorage.getItem('token')) {
  const role = getSessionRole(token).toLowerCase();
  return role === 'admin' || role === 'administrator';
}

export function isOrganizerSession(token = localStorage.getItem('token')) {
  const role = getSessionRole(token).toLowerCase();
  return role === 'organizer' || role === 'eventorganizer';
}

export function getGuestCity(token = localStorage.getItem('token')) {
  const payload = readJwtPayload(token);
  return normalizeCityName(payload?.guestCity || localStorage.getItem('mym_guest_city') || '');
}

export async function enterAsGuest(city) {
  const normalizedCity = normalizeCityName(city);
  const response = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city: normalizedCity }),
  });

  if (!response.ok) {
    throw new Error(await response.text() || 'Guest access could not be started.');
  }

  const data = await response.json();
  const token = data.token || data.accessToken;
  if (!token) throw new Error('Guest token was not returned.');

  const guestCity = normalizeCityName(data.user?.city || normalizedCity);
  localStorage.setItem('token', token);
  localStorage.setItem('mym_authed', 'true');
  localStorage.setItem('mym_guest_city', guestCity);
  localStorage.setItem('user', JSON.stringify({
    ...(data.user || {}),
    role: 'Guest',
    userType: 'Guest',
    city: guestCity,
  }));
  window.dispatchEvent(new Event('tokenChanged'));
  return { token, city: guestCity };
}
