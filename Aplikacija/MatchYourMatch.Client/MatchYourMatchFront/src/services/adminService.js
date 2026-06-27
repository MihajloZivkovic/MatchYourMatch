function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

async function readResponse(response, fallbackMessage) {
  if (response.ok) {
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  throw new Error((await response.text()) || fallbackMessage);
}

export const adminService = {
  async users() {
    const response = await fetch('/api/Admin/users', {
      headers: authHeaders(),
    });
    return readResponse(response, 'Users could not be loaded.');
  },

  async activateUser(userId) {
    const response = await fetch(`/api/Admin/users/activate/${userId}`, {
      headers: authHeaders(),
    });
    return readResponse(response, 'User could not be activated.');
  },

  async deactivateUser(userId) {
    const response = await fetch(`/api/Admin/users/deactivate/${userId}`, {
      method: 'PUT',
      headers: authHeaders(),
    });
    return readResponse(response, 'User could not be deactivated.');
  },

  async deleteUser(userId) {
    const response = await fetch(`/api/Admin/users/delete/${userId}`, {
      headers: authHeaders(),
    });
    return readResponse(response, 'User could not be deleted.');
  },

  async events() {
    const response = await fetch('/api/Events?includePast=true', {
      headers: authHeaders(),
    });
    return readResponse(response, 'Events could not be loaded.');
  },

  async deleteEvent(eventId) {
    const response = await fetch(`/api/Admin/events/${eventId}`, {
      headers: authHeaders(),
    });
    return readResponse(response, 'Event could not be deleted.');
  },
};
