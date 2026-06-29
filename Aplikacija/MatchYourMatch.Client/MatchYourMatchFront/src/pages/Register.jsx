import { useActionState, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import SocialAuthButtons from "../components/SocialAuthButtons";
import GuestEntryButton from "../components/GuestEntryButton";

const ACCOUNT_TYPES = {
  user: "User",
  organizer: "Organizer",
};

const emptyValues = {
  fullName: "",
  username: "",
  accountType: ACCOUNT_TYPES.user,
  organizationType: "",
  email: "",
  password: "",
  confirmPassword: "",
  dateOfBirth: "",
};

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
  const [accountType, setAccountType] = useState(emptyValues.accountType);
  const [state, formAction, isPending] = useActionState(handleSubmit, { error: null, values: emptyValues });
  const isOrganizer = accountType === ACCOUNT_TYPES.organizer;

  async function handleSubmit(_prevState, formData) {
    const values = {
      fullName: formData.get("fullName")?.trim() || "",
      username: formData.get("username")?.trim() || "",
      accountType: formData.get("accountType") || ACCOUNT_TYPES.user,
      organizationType: formData.get("organizationType")?.trim() || "",
      email: formData.get("email")?.trim() || "",
      dateOfBirth: formData.get("dateOfBirth") || "",
      password: formData.get("password") || "",
      confirmPassword: formData.get("confirmPassword") || "",
    };
    setAccountType(values.accountType);

    if (!values.fullName) return { error: values.accountType === ACCOUNT_TYPES.organizer ? t("auth.organizationNameRequired") : t("auth.fullNameRequired"), values };
    if (values.accountType === ACCOUNT_TYPES.user) {
      if (!values.dateOfBirth) return { error: t("auth.dateOfBirthRequired"), values };
      if (values.dateOfBirth > getLatestAllowedBirthDate()) return { error: t("auth.minimumAge"), values };
    }
    if (values.password !== values.confirmPassword) return { error: t("auth.passwordsMismatch"), values };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: values.username,
          accountType: values.accountType,
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          organizationType: values.accountType === ACCOUNT_TYPES.organizer && values.organizationType ? values.organizationType : null,
          dateOfBirth: values.accountType === ACCOUNT_TYPES.user ? values.dateOfBirth : null,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        return { error: message || t("auth.registrationFailed"), values };
      }

      const data = await response.json();
      const verificationEmail = data.email || values.email;
      sessionStorage.setItem('pendingVerificationEmail', verificationEmail);
      navigate("/verify-email", {
        replace: true,
        state: {
          email: verificationEmail,
          message: data.message || t("emailVerification.registrationSuccess"),
        },
      });
      setAccountType(emptyValues.accountType);
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

            <SocialAuthButtons register />

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-full-name">{isOrganizer ? t("auth.organizationName") : t("auth.fullName")}</label>
              <input id="register-full-name" className="auth__input" type="text" name="fullName"
                placeholder={isOrganizer ? t("auth.yourOrganizationName") : t("auth.yourFullName")} autoComplete="name" maxLength="160" required
                defaultValue={state.values.fullName} />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-username">{t("auth.username")}</label>
              <input id="register-username" className="auth__input" type="text" name="username"
                placeholder={t("auth.yourUsername")} autoComplete="username" required
                defaultValue={state.values.username} />
            </div>

            <div className="auth__field">
              <span className="auth__label" id="register-account-type-label">{t("auth.accountType")}</span>
              <div className="auth__account-type" role="radiogroup" aria-labelledby="register-account-type-label">
                <label className={`auth__account-pill ${accountType === ACCOUNT_TYPES.user ? "auth__account-pill--active" : ""}`}>
                  <input type="radio" name="accountType" value={ACCOUNT_TYPES.user}
                    checked={accountType === ACCOUNT_TYPES.user}
                    onChange={(event) => setAccountType(event.target.value)} />
                  <span>{t("auth.regularUser")}</span>
                </label>
                <label className={`auth__account-pill ${accountType === ACCOUNT_TYPES.organizer ? "auth__account-pill--active" : ""}`}>
                  <input type="radio" name="accountType" value={ACCOUNT_TYPES.organizer}
                    checked={accountType === ACCOUNT_TYPES.organizer}
                    onChange={(event) => setAccountType(event.target.value)} />
                  <span>{t("auth.organizer")}</span>
                </label>
              </div>
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-email">{t("auth.email")}</label>
              <input id="register-email" className="auth__input" type="email" name="email"
                placeholder="you@example.com" autoComplete="email" required defaultValue={state.values.email} />
            </div>

            {isOrganizer ? (
              <div className="auth__field">
                <label className="auth__label" htmlFor="register-organization-type">{t("auth.organizationTypeOptional")}</label>
                <input id="register-organization-type" className="auth__input" type="text" name="organizationType"
                  placeholder={t("auth.organizationTypePlaceholder")} maxLength="80"
                  defaultValue={state.values.organizationType} />
              </div>
            ) : (
              <div className="auth__field">
                <label className="auth__label" htmlFor="register-birthday">{t("auth.dateOfBirth")}</label>
                <input id="register-birthday" className="auth__input" type="date" name="dateOfBirth"
                  autoComplete="bday" max={getLatestAllowedBirthDate()} required defaultValue={state.values.dateOfBirth} />
              </div>
            )}

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
            <GuestEntryButton className="btn btn--outline auth__guest" labelKey="guest.continue" />
            <p className="auth__switch">{t("auth.hasAccount")} <Link to="/login" className="auth__switch-link">{t("nav.login")}</Link></p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Register;
