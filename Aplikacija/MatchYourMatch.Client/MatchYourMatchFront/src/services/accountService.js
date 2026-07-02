const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (response.ok) return response.status === 204 ? null : response.json();

  const rawBody = await response.text();
  let message = 'Account action failed.';

  try {
    const body = rawBody ? JSON.parse(rawBody) : null;
    message = body?.message || message;
  } catch {
    message = rawBody || message;
  }

  throw new Error(message);
}

export const accountService = {
  status: () => request('/api/account/status', { headers: headers() }),
  updateUsername: (payload) => request('/api/account/username', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  updateEmail: (payload) => request('/api/account/email', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  updatePassword: (payload) => request('/api/account/password', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  updateProfileVisibility: (payload) => request('/api/account/profile-visibility', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  deactivate: (payload) => request('/api/account/deactivate', { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
  delete: (payload) => request('/api/account', { method: 'DELETE', headers: headers(), body: JSON.stringify(payload) }),
};
