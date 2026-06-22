export const locationService = {
  async search(query, signal) {
    const response = await fetch(`/api/UserProfile/location-suggestions?query=${encodeURIComponent(query.trim())}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      signal,
    });
    if (!response.ok) throw new Error('Location suggestions could not be loaded.');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },
};
