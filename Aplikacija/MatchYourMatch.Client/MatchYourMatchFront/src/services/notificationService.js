const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (!response.ok) {
    let message = 'Notifications could not be loaded.';
    try {
      const body = await response.json();
      if (typeof body?.message === 'string' && body.message.length < 240) message = body.message;
    } catch { /* never expose raw server responses */ }
    const error = new Error(message);
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
  respondToQuickMatch: (id, action) => request(`/api/QuickMatch/requests/${id}/${action === 'decline' ? 'reject' : 'accept'}`, { method: 'POST' }),
  respondToEventJoinRequest: (eventId, requestId, action) =>
    request(`/api/Events/${eventId}/join-requests/${requestId}/${action === 'decline' ? 'reject' : 'accept'}`, { method: 'POST' }),
};

export const NOTIFICATIONS_CHANGED_EVENT = 'mym:notifications-changed';
export const EVENT_JOIN_REQUEST_CHANGED_EVENT = 'mym:event-join-request-changed';

export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function announceEventJoinRequestChanged(detail) {
  window.dispatchEvent(new CustomEvent(EVENT_JOIN_REQUEST_CHANGED_EVENT, { detail }));
  announceNotificationsChanged();
}
