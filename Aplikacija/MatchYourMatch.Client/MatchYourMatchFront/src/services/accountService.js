const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (response.ok) return response.status === 204 ? null : response.json();

  const rawBody = await response.text();
  let message = 'Account action failed.';
  let errorCode = '';

  try {
    const body = rawBody ? JSON.parse(rawBody) : null;
    message = body?.message || message;
    errorCode = body?.errorCode || body?.code || '';
  } catch {
    message = rawBody || message;
  }

  const error = new Error(message);
  error.status = response.status;
  error.errorCode = errorCode;
  throw error;
}

export const accountService = {
  status: () => request('/api/account/status', { headers: headers() }),
  updateUsername: (payload) => request('/api/account/username', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  updateEmail: (payload) => request('/api/account/email', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  verifyEmailChange: (payload) => request('/api/account/email/verify', { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
  resendEmailChangeCode: () => request('/api/account/email/resend', { method: 'POST', headers: headers() }),
  cancelEmailChange: () => request('/api/account/email/pending', { method: 'DELETE', headers: headers() }),
  updatePassword: (payload) => request('/api/account/password', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  updateProfileVisibility: (payload) => request('/api/account/profile-visibility', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) }),
  deactivate: (payload) => request('/api/account/deactivate', { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
  delete: (payload) => request('/api/account', { method: 'DELETE', headers: headers(), body: JSON.stringify(payload) }),
};
