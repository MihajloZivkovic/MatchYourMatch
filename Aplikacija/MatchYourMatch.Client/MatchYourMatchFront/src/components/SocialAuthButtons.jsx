import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EventType, PublicClientApplication } from '@azure/msal-browser';
import { FcGoogle } from 'react-icons/fc';
import { useTranslation } from '../hooks/useTranslation';
import SocialAuthButton from './SocialAuthButton';
import { isAdminSession } from '../services/guestSession';

const ACCOUNT_DEACTIVATED_CODE = 'ACCOUNT_DEACTIVATED';

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
    script.onerror = () =>
      reject(new Error('Provider SDK could not be loaded.'));
    document.head.appendChild(script);
  });
}

async function readAuthError(response) {
  const rawError = await response.text();
  if (!rawError) return { code: '', message: '' };

  try {
    const parsed = JSON.parse(rawError);
    return {
      code: parsed.code || '',
      message: parsed.message || rawError,
      requiresReactivation: Boolean(parsed.requiresReactivation),
    };
  } catch {
    return { code: '', message: rawError };
  }
}

function SocialAuthButtons({ register = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const microsoftRef = useRef(null);
  const microsoftInteractionRef = useRef(false);
  const microsoftAttemptRef = useRef(0);
  const microsoftPopupMonitorRef = useRef(null);
  const [activeProvider, setActiveProvider] = useState('');
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [microsoftReady, setMicrosoftReady] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const microsoftClientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  const microsoftTenantId =
    import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

  const finishLogin = useCallback(
    async (provider, payload) => {
      setActiveProvider(provider);
      setError('');
      try {
        const response = await fetch(`/api/auth/external-login/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        let data;
        if (response.status === 409) {
          const conflict = await readAuthError(response);
          if (!conflict.requiresReactivation)
            throw new Error(conflict.message || t('socialAuth.failed'));
          const reactivation = await fetch('/api/account/reactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, ...payload }),
          });
          if (!reactivation.ok)
            throw new Error(
              (await reactivation.text()) || t('socialAuth.failed'),
            );
          data = await reactivation.json();
        } else {
          if (!response.ok) {
            const authError = await readAuthError(response);
            if (
              response.status === 403 &&
              authError.code === ACCOUNT_DEACTIVATED_CODE
            ) {
              throw new Error(t('auth.accountDeactivated'));
            }
            throw new Error(authError.message || t('socialAuth.failed'));
          }
          data = await response.json();
        }
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('mym_authed', 'true');
        window.dispatchEvent(new Event('tokenChanged'));
        const requestedReturnUrl = new URLSearchParams(location.search).get(
          'returnUrl',
        );
        const destination = requestedReturnUrl?.startsWith('/app')
          ? requestedReturnUrl
          : '/app/dashboard';
        const adminDestination = requestedReturnUrl?.startsWith('/admin')
          ? requestedReturnUrl
          : '/admin/dashboard';
        navigate(
          isAdminSession(data.accessToken)
            ? adminDestination
            : data.requiresProfileCompletion
              ? '/complete-profile'
              : destination,
          { replace: true },
        );
      } catch (requestError) {
        setError(requestError.message || t('socialAuth.failed'));
      } finally {
        setActiveProvider('');
      }
    },
    [location.search, navigate, t],
  );

  useEffect(() => {
    if (!googleClientId) return undefined;
    let cancelled = false;
    const initialize = async () => {
      try {
        await loadScript('https://accounts.google.com/gsi/client', () =>
          Boolean(window.google),
        );
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) =>
            finishLogin('google', { idToken: credential }),
        });
        setGoogleReady(true);
      } catch (sdkError) {
        if (!cancelled) setError(sdkError.message);
      }
    };
    initialize();
    return () => {
      cancelled = true;
    };
  }, [finishLogin, googleClientId]);

  const loginWithGoogle = () => {
    if (!googleClientId) {
      setError(t('socialAuth.googleConfigMissing'));
      return;
    }
    if (!googleReady || !window.google) {
      setError(t('socialAuth.googleInitFailed'));
      return;
    }
    setActiveProvider('google');
    setError('');
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        setActiveProvider('');
        setError(t('socialAuth.googleUnavailable'));
      } else if (
        notification.isDismissedMoment?.() &&
        notification.getDismissedReason?.() !== 'credential_returned'
      ) {
        setActiveProvider('');
        setError(t('socialAuth.cancelled'));
      }
    });
  };

  useEffect(() => {
    if (!microsoftClientId || !microsoftTenantId) return undefined;
    let disposed = false;
    const instance = new PublicClientApplication({
      auth: {
        clientId: microsoftClientId,
        authority: `https://login.microsoftonline.com/${microsoftTenantId}`,
        redirectUri: `${window.location.origin}/`,
      },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    });
    microsoftRef.current = instance;
    const eventCallbackId = instance.addEventCallback((message) => {
      if (message.eventType === EventType.POPUP_OPENED) {
        const popupWindow = message.payload?.popupWindow;
        const attempt = microsoftAttemptRef.current;
        clearInterval(microsoftPopupMonitorRef.current);
        microsoftPopupMonitorRef.current = setInterval(() => {
          if (!popupWindow?.closed) return;
          clearInterval(microsoftPopupMonitorRef.current);
          microsoftPopupMonitorRef.current = null;
          window.setTimeout(() => {
            if (
              microsoftInteractionRef.current &&
              microsoftAttemptRef.current === attempt
            ) {
              microsoftAttemptRef.current += 1;
              microsoftInteractionRef.current = false;
              setActiveProvider((current) =>
                current === 'microsoft' ? '' : current,
              );
              setError(t('socialAuth.cancelled'));
            }
          }, 350);
        }, 250);
      } else if (
        [
          EventType.LOGIN_SUCCESS,
          EventType.LOGIN_FAILURE,
          EventType.ACQUIRE_TOKEN_SUCCESS,
          EventType.ACQUIRE_TOKEN_FAILURE,
        ].includes(message.eventType)
      ) {
        clearInterval(microsoftPopupMonitorRef.current);
        microsoftPopupMonitorRef.current = null;
      }
    });
    instance
      .initialize()
      .then(() => {
        if (!disposed) setMicrosoftReady(true);
      })
      .catch(() => {
        if (!disposed) setError(t('socialAuth.microsoftInitFailed'));
      });

    return () => {
      disposed = true;
      clearInterval(microsoftPopupMonitorRef.current);
      microsoftPopupMonitorRef.current = null;
      if (eventCallbackId) instance.removeEventCallback(eventCallbackId);
      if (microsoftRef.current === instance) microsoftRef.current = null;
    };
  }, [microsoftClientId, microsoftTenantId, t]);

  const loginWithMicrosoft = async () => {
    if (!microsoftClientId || !microsoftTenantId) {
      setError(t('socialAuth.microsoftConfigMissing'));
      return;
    }
    if (!microsoftReady || !microsoftRef.current) {
      setError(t('socialAuth.microsoftInitFailed'));
      return;
    }
    if (microsoftInteractionRef.current) return;
    microsoftInteractionRef.current = true;
    const attempt = ++microsoftAttemptRef.current;
    setActiveProvider('microsoft');
    setError('');
    try {
      const result = await microsoftRef.current.loginPopup({
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account',
        overrideInteractionInProgress: true,
      });
      if (!result.idToken) throw new Error(t('socialAuth.failed'));
      await finishLogin('microsoft', { idToken: result.idToken });
    } catch (sdkError) {
      if (microsoftAttemptRef.current === attempt) {
        setActiveProvider('');
        if (sdkError?.errorCode === 'user_cancelled')
          setError(t('socialAuth.cancelled'));
        else if (sdkError?.errorCode === 'popup_window_error')
          setError(t('socialAuth.popupBlocked'));
        else setError(sdkError.message || t('socialAuth.failed'));
      }
    } finally {
      if (microsoftAttemptRef.current === attempt)
        microsoftInteractionRef.current = false;
    }
  };

  const busy = Boolean(activeProvider);
  return (
    <div className='social-auth'>
      <div className='social-auth__separator'>
        <span>
          {t(register ? 'socialAuth.orCreate' : 'socialAuth.orContinue')}
        </span>
      </div>

      <SocialAuthButton
        provider='google'
        icon={<FcGoogle />}
        onClick={loginWithGoogle}
        loading={activeProvider === 'google'}
        disabled={busy || (Boolean(googleClientId) && !googleReady)}
      >
        {t('socialAuth.google')}
      </SocialAuthButton>
      <SocialAuthButton
        provider='microsoft'
        icon={
          <span className='social-auth__microsoft-logo'>
            <i />
            <i />
            <i />
            <i />
          </span>
        }
        onClick={loginWithMicrosoft}
        loading={activeProvider === 'microsoft'}
        disabled={busy || (Boolean(microsoftClientId) && !microsoftReady)}
      >
        {t('socialAuth.microsoft')}
      </SocialAuthButton>
      {error && (
        <p className='auth__error' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
}

export default SocialAuthButtons;
