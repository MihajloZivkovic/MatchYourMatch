const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error('Notifications request failed', {
      url: path,
      status: response.status,
      body,
    });
    const error = new Error(body || 'Notifications could not be loaded.');
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export const notificationService = {
  list: () => request('/api/Notifications'),
  unreadCount: () => request('/api/Notifications/unread-count'),
  markRead: (id) => request(`/api/Notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/api/Notifications/read-all', { method: 'PATCH' }),
  respondToInvite: (id, action) => request(`/api/Events/invites/${id}/${action}`, { method: 'POST' }),
};
