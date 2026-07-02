import { useActionState, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import SocialAuthButtons from '../components/SocialAuthButtons';
import GuestEntryButton from '../components/GuestEntryButton';
import { isAdminSession, isOrganizerSession } from '../services/guestSession';
import { PASSWORD_POLICY_MESSAGE, getPasswordValidationMessage } from '../utils/passwordPolicy';

const ACCOUNT_DEACTIVATED_CODE = 'ACCOUNT_DEACTIVATED';

async function readLoginError(response) {
  const fallback = { code: '', message: '' };
  const rawError = await response.text();

  if (!rawError) return fallback;

  try {
    const parsed = JSON.parse(rawError);
    return {
      code: parsed.code || '',
      message: parsed.message || rawError,
      requiresReactivation: Boolean(parsed.requiresReactivation),
    };
  } catch {
    return { ...fallback, message: rawError };
  }
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const requestedReturnUrl = new URLSearchParams(location.search).get('returnUrl');
  const loginDestination = requestedReturnUrl?.startsWith('/app')
    ? requestedReturnUrl
    : '/app/dashboard';
  const organizerDestination = requestedReturnUrl?.startsWith('/app')
    ? requestedReturnUrl
    : '/app/organizer';
  const adminDestination = requestedReturnUrl?.startsWith('/admin')
    ? requestedReturnUrl
    : '/admin/dashboard';
  const [vrstaGreske, setVrstaGreske] = useState("")
  const [reactivationCredentials, setReactivationCredentials] = useState(null);
  const [resetPanel, setResetPanel] = useState({
    open: false,
    step: 'request',
    email: '',
    token: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    message: '',
    error: '',
  });
  const [state, formAction] = useActionState(handleSubmit, {
    error: null,
    values: { emailOrUsername: "", password: "" }
  })


  async function handleSubmit(prevState, formData) {
    const emailOrUsername = formData.get("emailOrUsername")?.trim() || ""
    const password = formData.get("password")

    if (!emailOrUsername) {
      setVrstaGreske("identifier");
      return {
        error: t('auth.identifierRequired'),
        values: { emailOrUsername, password }
      };
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailOrUsername,
        password: password,
      }),
    });

    if (!response.ok) {
      const loginError = await readLoginError(response);
      setReactivationCredentials(null);

      if (response.status === 403 && loginError.code === ACCOUNT_DEACTIVATED_CODE) {
        setVrstaGreske("adminDeactivated");
      }
      else if (response.status === 409 && loginError.requiresReactivation) {
        setVrstaGreske("deactivated");
        setReactivationCredentials({ email: emailOrUsername, password });
      }
      else if (response.status === 403) {
        setVrstaGreske("verify");
        if (emailOrUsername.includes('@')) sessionStorage.setItem('pendingVerificationEmail', emailOrUsername);
      }
      else {
        setVrstaGreske("invalid");
      }

      return {
        error: loginError.message || t('auth.invalidLogin'),
        values: { emailOrUsername, password }
      }
    }
    setVrstaGreske("");
    setReactivationCredentials(null);
    const data = await response.json();

    localStorage.setItem("token", data.accessToken);
    localStorage.setItem('mym_authed', 'true');
    window.dispatchEvent(new Event('tokenChanged'));
    navigate(getPostLoginDestination(data.accessToken), { replace: true });
  }

  function getPostLoginDestination(token) {
    if (isAdminSession(token)) return adminDestination;
    if (isOrganizerSession(token)) return organizerDestination;
    return loginDestination;
  }

  function getLoginErrorMessage() {
    switch (vrstaGreske) {
      case 'adminDeactivated':
        return t('auth.accountDeactivated');
      case 'deactivated':
        return 'This account is deactivated.';
      case 'verify':
        return t('emailVerification.loginBlocked');
      case 'identifier':
        return t('auth.identifierRequired');
      default:
        return t('auth.invalidLogin');
    }
  }

  const updateResetPanel = (patch) => {
    setResetPanel((current) => ({ ...current, ...patch }));
  };

  const requestPasswordReset = async () => {
    const email = resetPanel.email.trim();
    if (!email) {
      updateResetPanel({ error: t('passwordReset.emailRequired'), message: '' });
      return;
    }

    updateResetPanel({ loading: true, error: '', message: '' });
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await response.text());
      updateResetPanel({
        step: 'reset',
        loading: false,
        email,
        message: t('passwordReset.sent'),
      });
    } catch {
      updateResetPanel({
        loading: false,
        error: t('passwordReset.requestError'),
      });
    }
  };

  const submitNewPassword = async () => {
    const token = resetPanel.token.trim();
    if (!token || !resetPanel.newPassword) {
      updateResetPanel({ error: t('passwordReset.missingFields'), message: '' });
      return;
    }
    if (resetPanel.newPassword !== resetPanel.confirmPassword) {
      updateResetPanel({ error: t('auth.passwordsMismatch'), message: '' });
      return;
    }
    const passwordError = getPasswordValidationMessage(resetPanel.newPassword);
    if (passwordError) {
      updateResetPanel({ error: passwordError, message: '' });
      return;
    }

    updateResetPanel({ loading: true, error: '', message: '' });
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: resetPanel.newPassword,
        }),
      });
      if (!response.ok) {
        const resetError = await readLoginError(response);
        throw new Error(resetError.message || t('passwordReset.resetError'));
      }
      updateResetPanel({
        step: 'done',
        loading: false,
        token: '',
        newPassword: '',
        confirmPassword: '',
        message: t('passwordReset.success'),
      });
    } catch (error) {
      updateResetPanel({
        loading: false,
        error: error.message || t('passwordReset.resetError'),
      });
    }
  };

  return (
    <div className="page-fade-in">
      <main className="page__main page__main--auth">
        <div className="auth">
          <form className="auth__card" action={formAction}>
            <h1 className="auth__title">{t('nav.login').toUpperCase()}</h1>

            {location.state?.accountMessage && <p className="auth__verification-success" role="status">{location.state.accountMessage}</p>}

            {state.error && (
              <p className="auth__error" role="alert">
                {getLoginErrorMessage()}
              </p>
            )}
            {vrstaGreske === 'verify' && <p className="auth__switch"><Link to="/verify-email" state={{email: state.values.emailOrUsername?.includes('@') ? state.values.emailOrUsername : ''}} className="auth__switch-link">{t('emailVerification.resend')}</Link></p>}
            {vrstaGreske === 'deactivated' && reactivationCredentials && <button type="button" className="btn btn--primary auth__submit" onClick={async () => {
              const response = await fetch('/api/account/reactivate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(reactivationCredentials) });
              if (!response.ok) return;
              const data = await response.json(); localStorage.setItem('token', data.accessToken); localStorage.setItem('mym_authed','true'); window.dispatchEvent(new Event('tokenChanged')); navigate(getPostLoginDestination(data.accessToken), {replace:true});
            }}>Reactivate account</button>}

            <SocialAuthButtons />

            <div className="auth__field">
              <label className="auth__label" htmlFor="login-identifier">
                {t('auth.emailOrUsername')}
              </label>
              <input
                id="login-identifier"
                className={`auth__input ${vrstaGreske === "identifier" || vrstaGreske === "invalid" ? "input-danger" : ""}`}
                type="text"
                name="emailOrUsername"
                placeholder={t('auth.emailOrUsernamePlaceholder')}
                autoComplete="username"
                required
                defaultValue={state.values.emailOrUsername}
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="login-password">
                {t('auth.password')}
              </label>
              <input
                id="login-password"
                className={`auth__input ${vrstaGreske === "invalid" ? "input-danger" : ""}`}
                type="password"
                name="password"
                placeholder={vrstaGreske === "password" ? "pogresna lozinka" : "••••••••"}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="button"
              className="auth__forgot"
              onClick={() =>
                setResetPanel((current) => ({
                  ...current,
                  open: !current.open,
                  email: current.email || (state.values.emailOrUsername?.includes('@') ? state.values.emailOrUsername : ''),
                  error: '',
                  message: '',
                }))
              }
            >
              {t('passwordReset.forgot')}
            </button>

            {resetPanel.open && (
              <div className="auth__reset-panel">
                <p>{t('passwordReset.copy')}</p>
                {resetPanel.message && (
                  <span className="auth__verification-success" role="status">
                    {resetPanel.message}
                  </span>
                )}
                {resetPanel.error && (
                  <span className="auth__error" role="alert">
                    {resetPanel.error}
                  </span>
                )}
                {resetPanel.step === 'request' && (
                  <>
                    <input
                      className="auth__input"
                      type="email"
                      value={resetPanel.email}
                      placeholder="you@example.com"
                      autoComplete="email"
                      onChange={(event) => updateResetPanel({ email: event.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn--outline auth__reset-action"
                      disabled={resetPanel.loading}
                      onClick={requestPasswordReset}
                    >
                      {resetPanel.loading ? t('common.loading') : t('passwordReset.send')}
                    </button>
                  </>
                )}
                {(resetPanel.step === 'reset' || resetPanel.step === 'done') && (
                  <>
                    <input
                      className="auth__input"
                      type="text"
                      value={resetPanel.token}
                      placeholder={t('passwordReset.token')}
                      autoComplete="one-time-code"
                      disabled={resetPanel.step === 'done'}
                      onChange={(event) => updateResetPanel({ token: event.target.value })}
                    />
                    <input
                      className="auth__input"
                      type="password"
                      value={resetPanel.newPassword}
                      placeholder={t('passwordReset.newPassword')}
                      autoComplete="new-password"
                      disabled={resetPanel.step === 'done'}
                      onChange={(event) => updateResetPanel({ newPassword: event.target.value })}
                    />
                    <p className="auth__hint">{PASSWORD_POLICY_MESSAGE}</p>
                    <input
                      className="auth__input"
                      type="password"
                      value={resetPanel.confirmPassword}
                      placeholder={t('passwordReset.confirmPassword')}
                      autoComplete="new-password"
                      disabled={resetPanel.step === 'done'}
                      onChange={(event) => updateResetPanel({ confirmPassword: event.target.value })}
                    />
                    {resetPanel.step !== 'done' && (
                      <button
                        type="button"
                        className="btn btn--outline auth__reset-action"
                        disabled={resetPanel.loading}
                        onClick={submitNewPassword}
                      >
                        {resetPanel.loading ? t('common.loading') : t('passwordReset.update')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <button type="submit" className="btn btn--primary auth__submit">
              {t('auth.signIn').toUpperCase()}
            </button>

            <GuestEntryButton className="btn btn--outline auth__guest" labelKey="guest.continue" />

            <p className="auth__switch">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="auth__switch-link">
                {t('nav.register')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Login;
