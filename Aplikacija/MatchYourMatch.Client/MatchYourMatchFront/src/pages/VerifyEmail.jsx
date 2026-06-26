import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

function VerifyEmail() {
  const { t } = useTranslation();
  const location = useLocation();
  const [email, setEmail] = useState(
    location.state?.email ||
      sessionStorage.getItem('pendingVerificationEmail') ||
      '',
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(email ? 30 : 0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const verify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      if (!response.ok) throw new Error(t('emailVerification.invalid'));
      sessionStorage.removeItem('pendingVerificationEmail');
      setVerified(true);
      setMessage(t('emailVerification.success'));
    } catch (err) {
      setError(err.message || t('emailVerification.invalid'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim() || cooldown > 0) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error(t('common.error'));
      sessionStorage.setItem('pendingVerificationEmail', email.trim());
      setMessage(t('emailVerification.resent'));
      setCooldown(30);
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
          <form className='auth__card' onSubmit={verify}>
            <h1 className='auth__title'>{t('emailVerification.title')}</h1>
            <p className='auth__verification-copy'>
              {t('emailVerification.sent')}
            </p>
            {error && (
              <p className='auth__error' role='alert'>
                {error}
              </p>
            )}
            {message && (
              <p className='auth__verification-success' role='status'>
                {message}
              </p>
            )}
            {!verified && (
              <>
                <div className='auth__field'>
                  <label className='auth__label' htmlFor='verify-email'>
                    {t('auth.email')}
                  </label>
                  <input
                    id='verify-email'
                    className='auth__input'
                    type='email'
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className='auth__field'>
                  <label className='auth__label' htmlFor='verification-code'>
                    {t('emailVerification.code')}
                  </label>
                  <input
                    id='verification-code'
                    className='auth__input auth__verification-code'
                    inputMode='numeric'
                    pattern='[0-9]{6}'
                    maxLength='6'
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ''))
                    }
                  />
                </div>
                <button
                  className='btn btn--primary auth__submit'
                  type='submit'
                  disabled={loading || code.length !== 6}
                >
                  {loading
                    ? t('common.loading')
                    : t('emailVerification.verify')}
                </button>
                <button
                  className='auth__resend'
                  type='button'
                  onClick={resend}
                  disabled={loading || cooldown > 0 || !email.trim()}
                >
                  {cooldown > 0
                    ? `${t('emailVerification.resend')} (${cooldown}s)`
                    : t('emailVerification.resend')}
                </button>
              </>
            )}
            <p className='auth__switch'>
              <Link to='/login' className='auth__switch-link'>
                {t('emailVerification.backLogin')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default VerifyEmail;
