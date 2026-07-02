export const handleLeaveAPI = async (eventId, t) => {
  const response = await fetch(`/api/Events/${eventId}/join`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    let errorMessage = t('events.leaveError');
    try {
      errorMessage = await response.text() || errorMessage;
    } catch {
        //default poruka
    }
    throw new Error(errorMessage);
  }
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null; 
    }

    try {
        return await response.json();
    } catch (e) {
        console.log('Error parsing JSON', e);
        return null;
    }
    };