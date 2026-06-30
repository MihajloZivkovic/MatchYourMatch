const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await readError(response);
    const error = new Error(message || 'Organizer data could not be loaded.');
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

async function readError(response) {
  const text = await response.text();
  if (!text) return '';
  try {
    const data = JSON.parse(text);
    return data?.message || data?.title || text;
  } catch {
    return text;
  }
}

export const organizerService = {
  profile: () => request('/api/UserProfile/me', { method: 'GET' }),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/UserProfile/me/profile-picture', {
      method: 'POST',
      body: formData,
    });
  },
  updateProfileImage: (profile, profilePicture) =>
    request('/api/UserProfile/me', {
      method: 'PUT',
      body: JSON.stringify({
        bio: profile?.bio || null,
        profilePicture: profilePicture || null,
        location: profile?.locationRawInput || profile?.locationDisplayName || profile?.location || null,
        locationPrivacy: profile?.locationPrivacy || 'CityOnly',
        fullName: profile?.fullName || null,
        showFullName: Boolean(profile?.showFullName),
        dateOfBirth: profile?.dateOfBirth || null,
        showAge: Boolean(profile?.showAge),
      }),
    }),
  events: () => request('/api/Events/me', { method: 'GET' }),
  joinRequests: (eventId) => request(`/api/Events/${eventId}/join-requests`, { method: 'GET' }),
  acceptJoinRequest: (eventId, requestId) =>
    request(`/api/Events/${eventId}/join-requests/${requestId}/accept`, { method: 'POST' }),
  rejectJoinRequest: (eventId, requestId) =>
    request(`/api/Events/${eventId}/join-requests/${requestId}/reject`, { method: 'POST' }),
  deleteEvent: (eventId) => request(`/api/Events/${eventId}`, { method: 'DELETE' }),
};
