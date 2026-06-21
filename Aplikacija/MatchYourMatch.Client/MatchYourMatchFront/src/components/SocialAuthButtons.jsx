import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import { useTranslation } from '../hooks/useTranslation';

const FACEBOOK_SDK = 'https://connect.facebook.net/en_US/sdk.js';

function loadScript(src, ready) {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Provider SDK could not be loaded.'));
    document.head.appendChild(script);
  });
}

function SocialAuthButtons({ register = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const googleRef = useRef(null);
  const microsoftRef = useRef(null);
  const [activeProvider, setActiveProvider] = useState('');
  const [error, setError] = useState('');
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const facebookAppId = import.meta.env.VITE_FACEBOOK_APP_ID;
  const microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const microsoftTenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

  const finishLogin = useCallback(async (provider, payload) => {
    setActiveProvider(provider);
    setError('');
    try {
      const response = await fetch(`/api/auth/external-login/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.text()) || t('socialAuth.failed'));
      const data = await response.json();
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('mym_authed', 'true');
      window.dispatchEvent(new Event('tokenChanged'));
      navigate(data.requiresProfileCompletion ? '/complete-profile' : '/app/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message || t('socialAuth.failed'));
    } finally {
      setActiveProvider('');
    }
  }, [navigate, t]);

  useEffect(() => {
    if (!googleClientId) return undefined;
    let cancelled = false;
    const render = async () => {
      try {
        await loadScript('https://accounts.google.com/gsi/client', () => Boolean(window.google));
        if (cancelled || !googleRef.current) return;
        googleRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => finishLogin('google', { idToken: credential }),
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: 'outline', size: 'large', width: 320,
          text: register ? 'signup_with' : 'continue_with',
        });
      } catch (sdkError) {
        if (!cancelled) setError(sdkError.message);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [finishLogin, googleClientId, register]);

  const loginWithFacebook = async () => {
    if (!facebookAppId) {
      setError(t('socialAuth.facebookConfigMissing'));
      return;
    }
    setActiveProvider('facebook');
    setError('');
    try {
      await loadScript(FACEBOOK_SDK, () => Boolean(window.FB));
      window.FB.init({ appId: facebookAppId, cookie: false, xfbml: false, version: 'v22.0' });
      window.FB.login((response) => {
        if (!response.authResponse?.accessToken) {
          setActiveProvider('');
          setError(t('socialAuth.cancelled'));
          return;
        }
        finishLogin('facebook', { accessToken: response.authResponse.accessToken });
      }, { scope: 'public_profile,email', return_scopes: true });
    } catch (sdkError) {
      setActiveProvider('');
      setError(sdkError.message || t('socialAuth.failed'));
    }
  };

  const loginWithMicrosoft = async () => {
    if (!microsoftClientId || !microsoftTenantId) {
      setError(t('socialAuth.microsoftConfigMissing'));
      return;
    }
    setActiveProvider('microsoft');
    setError('');
    try {
      if (!microsoftRef.current) {
        microsoftRef.current = new PublicClientApplication({
          auth: {
            clientId: microsoftClientId,
            authority: `https://login.microsoftonline.com/${microsoftTenantId}`,
            redirectUri: `${window.location.origin}/`,
          },
          cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
        });
        if (typeof microsoftRef.current.initialize === 'function') await microsoftRef.current.initialize();
      }
      const result = await microsoftRef.current.loginPopup({
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account',
      });
      if (!result.idToken) throw new Error(t('socialAuth.failed'));
      await finishLogin('microsoft', { idToken: result.idToken });
    } catch (sdkError) {
      setActiveProvider('');
      const cancelled = sdkError?.errorCode === 'user_cancelled' || sdkError?.errorCode === 'popup_window_error';
      setError(cancelled ? t('socialAuth.cancelled') : (sdkError.message || t('socialAuth.failed')));
    }
  };

  const busy = Boolean(activeProvider);
  return (
    <div className="social-auth">
      <div className="social-auth__separator">
        <span>{t(register ? 'socialAuth.orCreate' : 'socialAuth.orContinue')}</span>
      </div>

      {googleClientId ? (
        <div className={`social-auth__google${activeProvider === 'google' ? ' is-loading' : ''}`} ref={googleRef} />
      ) : (
        <button type="button" className="social-auth__button social-auth__button--google" onClick={() => setError(t('socialAuth.googleConfigMissing'))}>
          {t('socialAuth.google')}
        </button>
      )}
      <button type="button" className="social-auth__button social-auth__button--facebook" onClick={loginWithFacebook} disabled={busy}>
        {activeProvider === 'facebook' ? t('socialAuth.connecting') : t('socialAuth.facebook')}
      </button>
      <button type="button" className="social-auth__button social-auth__button--microsoft" onClick={loginWithMicrosoft} disabled={busy}>
        {activeProvider === 'microsoft' ? t('socialAuth.connecting') : t('socialAuth.microsoft')}
      </button>
      {error && <p className="auth__error" role="alert">{error}</p>}
    </div>
  );
}

export default SocialAuthButtons;
