import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { clearAuthSession } from '../services/authSession';

function ProtectedRoute({ children }) {
  const [isAuthed, setIsAuthed] = useState(readAuthState);

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
    if (!isAuthed && (localStorage.getItem('token') || localStorage.getItem('mym_authed'))) clearAuthSession();
  }, [isAuthed]);

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function readAuthState() {
  return localStorage.getItem('mym_authed') === 'true' && isUsableJwt(localStorage.getItem('token'));
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

export default ProtectedRoute;
