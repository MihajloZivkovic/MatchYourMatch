import { useActionState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from '../hooks/useTranslation';

function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, formAction] = useActionState(handleSubmit, {
    error: null,
    values: { username: "", email: "", password: "", confirmPassword: "" },
  });

  async function handleSubmit(prevState,formData) {
    const username = formData.get("fullName");
    const email = formData.get("email");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if(password !== confirmPassword){
      return{
        error: t('auth.passwordsMismatch'),
        values: {username,email,password,confirmPassword}
      }
    }else{
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password,
        }),
      });
      navigate('/login')
    }
  }

  return (
    <div className="page-fade-in">
      <main className="page__main page__main--auth">
        <div className="auth">
          <form className="auth__card" action={formAction}>
            <h1 className="auth__title">{t('nav.register').toUpperCase()}</h1>

            {state.error && (
              <p className="auth__error" role="alert">
                {state.error}
              </p>
            )}

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-name">
                {t('auth.username')}
              </label>
              <input
                id="register-name"
                className="auth__input"
                type="text"
                name="fullName"
                placeholder={t('auth.yourUsername')}
                autoComplete="name"
                defaultValue={state.values.username || ""}
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-email">
                {t('auth.email')}
              </label>
              <input
                id="register-email"
                className="auth__input"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                defaultValue={state.values.email || ""}
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-password">
                {t('auth.password')}
              </label>
              <input
                id="register-password"
                className="auth__input"
                type="password"
                name="password"
                placeholder="••••••••"
                autoComplete="new-password"
                defaultValue={state.values.password || ""}
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-confirm">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="register-confirm"
                className={`auth__input ${state.error ? "input-danger" : ""}`} //ako nisu iste dodaje klasu koja ga zacrveni
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                autoComplete="new-password"
                defaultValue={state.values.confirmPassword || ""}
              />
            </div>

            <button type="submit" className="btn btn--primary auth__submit">
              {t('auth.createAccount').toUpperCase()}
            </button>

            <p className="auth__switch">
              {t('auth.hasAccount')}{" "}
              <Link to="/login" className="auth__switch-link">
                {t('nav.login')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Register;
