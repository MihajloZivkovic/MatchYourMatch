import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { clearAuthSession } from '../services/authSession';
import { isAdminSession } from '../services/guestSession';
import { isSessionExpired } from '../services/sessionExpiry';

function AdminRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const isAuthed =
    localStorage.getItem('mym_authed') === 'true' && isUsableJwt(token);

  if (isSessionExpired()) return children;

  if (!isAuthed) {
    if (token || localStorage.getItem('mym_authed')) clearAuthSession();
    return (
      <Navigate
        to={`/login?returnUrl=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  if (!isAdminSession(token)) {
    return <AdminAccessDenied />;
  }

  return children;
}

function AdminAccessDenied() {
  const { t } = useTranslation();

  return (
    <div className='app-shell admin-shell'>
      <div className='app-shell__bg' aria-hidden='true'>
        <span className='app-shell__grain' />
        <span className='app-shell__glow app-shell__glow--tl' />
        <span className='app-shell__glow app-shell__glow--br' />
      </div>
      <main className='admin-access-denied'>
        <section>
          <span>MYM ADMIN</span>
          <h1>{t('admin.accessDenied.title')}</h1>
          <p>{t('admin.accessDenied.message')}</p>
          <a href='/app/dashboard'>{t('admin.accessDenied.back')}</a>
        </section>
      </main>
    </div>
  );
}

function isUsableJwt(token) {
  if (!token) return false;

  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return !decoded.exp || decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default AdminRoute;
