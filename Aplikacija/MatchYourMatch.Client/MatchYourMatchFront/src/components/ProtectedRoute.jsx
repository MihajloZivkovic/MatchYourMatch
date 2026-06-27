import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearAuthSession } from '../services/authSession';
import { isGuestSession } from '../services/guestSession';
import { isSessionExpired } from '../services/sessionExpiry';

function ProtectedRoute({ children }) {
  const [isAuthed, setIsAuthed] = useState(readAuthState);
  const location = useLocation();

  useEffect(() => {
    const refresh = () => setIsAuthed(readAuthState());
    window.addEventListener('tokenChanged', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('tokenChanged', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (
      !isAuthed &&
      (localStorage.getItem('token') || localStorage.getItem('mym_authed'))
    )
      clearAuthSession();
  }, [isAuthed]);

  if (isSessionExpired()) return children;

  if (!isAuthed) {
    return <Navigate to='/login' replace />;
  }

  if (isGuestSession()) {
    const allowedGuestPaths = ['/app', '/app/events'];
    if (!allowedGuestPaths.includes(location.pathname)) {
      return <Navigate to="/app/events" replace state={{ guestBlocked: true }} />;
    }
    return children;
  }

  if (!hasCompletedProfile(localStorage.getItem('token'))) {
    return <Navigate to='/complete-profile' replace />;
  }

  return children;
}

function readAuthState() {
  return (
    localStorage.getItem('mym_authed') === 'true' &&
    isUsableJwt(localStorage.getItem('token'))
  );
}

function isUsableJwt(token) {
  if (!token) return false;

  try {
    const [, payload] = token.split('.');
    if (!payload) return false;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));

    if (!decoded.exp) return true;

    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function hasCompletedProfile(token) {
  try {
    const [, payload] = token.split('.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return (
      decoded.profileComplete !== 'false' && decoded.profileComplete !== false
    );
  } catch {
    return false;
  }
}

export default ProtectedRoute;
