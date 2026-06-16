import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const isAuthed = localStorage.getItem('mym_authed') === 'true';
  const token = localStorage.getItem('token');

  if (!isAuthed || !isUsableJwt(token)) {
    localStorage.removeItem('mym_authed');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('tokenChanged'));
    return <Navigate to="/login" replace />;
  }

  return children;
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
