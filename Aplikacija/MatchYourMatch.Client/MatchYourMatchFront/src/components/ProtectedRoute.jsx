import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const isAuthed = localStorage.getItem('mym_authed') === 'true';

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
