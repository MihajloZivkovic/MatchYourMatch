const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (response.ok) return response.status === 204 ? null : response.json();
  let message = 'Account action failed.';
  try {
    const body = await response.json();
    message = body.message || message;
  } catch {
    message = (await response.text()) || message;
  }
  throw new Error(message);
}

export const accountService = {
  status: () => request('/api/account/status', { headers: headers() }),
  deactivate: (payload) => request('/api/account/deactivate', { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
  delete: (payload) => request('/api/account', { method: 'DELETE', headers: headers(), body: JSON.stringify(payload) }),
};
