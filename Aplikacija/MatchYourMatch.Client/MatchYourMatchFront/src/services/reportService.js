const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function parseResponse(response) {
  const body = await response.text();
  if (!response.ok) {
    let message = body || 'Report action could not be completed.';
    try {
      const parsed = JSON.parse(body);
      message = parsed.message || parsed.title || message;
    } catch {
      // Keep the raw response text when the API does not return JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body ? JSON.parse(body) : null;
}

export const reportService = {
  submit: ({ reportedUserId, reason, details }) => fetch('/api/Reports', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportedUserId, reason, details }),
  }).then(parseResponse),
  history: ({ page = 1, pageSize = 10 } = {}) => fetch(`/api/Reports/my-history?page=${page}&pageSize=${pageSize}`, {
    headers: authHeaders(),
  }).then(parseResponse),
};
