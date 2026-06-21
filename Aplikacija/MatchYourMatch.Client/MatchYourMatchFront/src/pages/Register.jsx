import { useActionState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";

const emptyValues = { fullName: "", username: "", email: "", password: "", confirmPassword: "", dateOfBirth: "" };

function getLatestAllowedBirthDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 16);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, formAction, isPending] = useActionState(handleSubmit, { error: null, values: emptyValues });

  async function handleSubmit(_prevState, formData) {
    const values = {
      fullName: formData.get("fullName")?.trim() || "",
      username: formData.get("username")?.trim() || "",
      email: formData.get("email")?.trim() || "",
      dateOfBirth: formData.get("dateOfBirth") || "",
      password: formData.get("password") || "",
      confirmPassword: formData.get("confirmPassword") || "",
    };

    if (!values.fullName) return { error: t("auth.fullNameRequired"), values };
    if (!values.dateOfBirth) return { error: t("auth.dateOfBirthRequired"), values };
    if (values.dateOfBirth > getLatestAllowedBirthDate()) return { error: t("auth.minimumAge"), values };
    if (values.password !== values.confirmPassword) return { error: t("auth.passwordsMismatch"), values };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          dateOfBirth: values.dateOfBirth,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        return { error: message || t("auth.registrationFailed"), values };
      }

      navigate("/login");
      return { error: null, values: emptyValues };
    } catch {
      return { error: t("auth.registrationFailed"), values };
    }
  }

  return (
    <div className="page-fade-in">
      <main className="page__main page__main--auth">
        <div className="auth">
          <form className="auth__card" action={formAction}>
            <h1 className="auth__title">{t("nav.register").toUpperCase()}</h1>
            {state.error && <p className="auth__error" role="alert">{state.error}</p>}

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-full-name">{t("auth.fullName")}</label>
              <input id="register-full-name" className="auth__input" type="text" name="fullName"
                placeholder={t("auth.yourFullName")} autoComplete="name" maxLength="160" required
                defaultValue={state.values.fullName} />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-username">{t("auth.username")}</label>
              <input id="register-username" className="auth__input" type="text" name="username"
                placeholder={t("auth.yourUsername")} autoComplete="username" required
                defaultValue={state.values.username} />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-email">{t("auth.email")}</label>
              <input id="register-email" className="auth__input" type="email" name="email"
                placeholder="you@example.com" autoComplete="email" required defaultValue={state.values.email} />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-birthday">{t("auth.dateOfBirth")}</label>
              <input id="register-birthday" className="auth__input" type="date" name="dateOfBirth"
                autoComplete="bday" max={getLatestAllowedBirthDate()} required defaultValue={state.values.dateOfBirth} />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-password">{t("auth.password")}</label>
              <input id="register-password" className="auth__input" type="password" name="password"
                placeholder="••••••••" autoComplete="new-password" required defaultValue={state.values.password} />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-confirm">{t("auth.confirmPassword")}</label>
              <input id="register-confirm" className={`auth__input ${state.error ? "input-danger" : ""}`}
                type="password" name="confirmPassword" placeholder="••••••••" autoComplete="new-password"
                required defaultValue={state.values.confirmPassword} />
            </div>

            <button type="submit" className="btn btn--primary auth__submit" disabled={isPending}>
              {(isPending ? t("common.loading") : t("auth.createAccount")).toUpperCase()}
            </button>
            <p className="auth__switch">{t("auth.hasAccount")} <Link to="/login" className="auth__switch-link">{t("nav.login")}</Link></p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Register;
