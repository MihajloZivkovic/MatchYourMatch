async function request(eventId, save) {
  const response = await fetch(`/api/Events/${eventId}/save`, {
    method: save ? 'POST' : 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!response.ok) {
    let message = 'Saved event could not be updated.';
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') message = body.message;
    } catch { /* never expose a raw backend response */ }
    throw new Error(message);
  }
  return save ? response.json() : null;
}

export const savedEventService = {
  save: (eventId) => request(eventId, true),
  remove: (eventId) => request(eventId, false),
};
