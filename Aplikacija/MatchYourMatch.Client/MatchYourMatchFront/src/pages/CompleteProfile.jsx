import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { isOrganizerSession } from '../services/guestSession';

function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    dateOfBirth: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (isOrganizerSession(token)) {
      navigate('/app/organizer', { replace: true });
      return;
    }
    fetch('/api/UserProfile/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) =>
        setForm((current) => ({
          ...current,
          username: data.username || '',
          fullName: data.fullName || '',
        })),
      )
      .catch(() => setError(t('common.error')));
  }, [navigate, t]);
  const maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 16);
    return d.toISOString().slice(0, 10);
  })();
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/complete-social-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      localStorage.setItem('token', data.accessToken);
      window.dispatchEvent(new Event('tokenChanged'));
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className='page-fade-in'>
      <main className='page__main page__main--auth'>
        <div className='auth'>
          <form className='auth__card' onSubmit={submit}>
            <h1 className='auth__title'>{t('socialAuth.completeTitle')}</h1>
            <p className='auth__verification-copy'>
              {t('socialAuth.completeText')}
            </p>
            {error && <p className='auth__error'>{error}</p>}
            <div className='auth__field'>
              <label className='auth__label'>{t('auth.username')}</label>
              <input
                className='auth__input'
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className='auth__field'>
              <label className='auth__label'>{t('auth.fullName')}</label>
              <input
                className='auth__input'
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className='auth__field'>
              <label className='auth__label'>{t('auth.dateOfBirth')}</label>
              <input
                className='auth__input'
                type='date'
                required
                max={maxDate}
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm({ ...form, dateOfBirth: e.target.value })
                }
              />
            </div>
            <button
              className='btn btn--primary auth__submit'
              disabled={loading}
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
export default CompleteProfile;
