const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...options.headers } });
  if (!response.ok) throw new Error(await response.text() || 'Action could not be completed.');
  return response.status === 204 ? null : response.json();
}
export const safetyService = {
  blocked: () => request('/api/Settings/blocked-users'),
  hidden: () => request('/api/Settings/hidden-profiles'),
  block: (id) => request(`/api/Settings/blocked-users/${id}`, { method: 'POST' }),
  unblock: (id) => request(`/api/Settings/blocked-users/${id}`, { method: 'DELETE' }),
  hide: (id) => request(`/api/Settings/hidden-profiles/${id}`, { method: 'POST' }),
  unhide: (id) => request(`/api/Settings/hidden-profiles/${id}`, { method: 'DELETE' }),
};
