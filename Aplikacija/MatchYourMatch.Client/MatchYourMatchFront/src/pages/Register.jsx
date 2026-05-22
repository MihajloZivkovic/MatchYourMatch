import { useActionState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
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
        error: "lozinke se ne poklapaju",
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
            <h1 className="auth__title">REGISTER</h1>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-name">
                Username
              </label>
              <input
                id="register-name"
                className="auth__input"
                type="text"
                name="fullName"
                placeholder="Your username"
                autoComplete="name"
                defaultValue={state.values.username || ""}
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="register-email">
                Email
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
                Password
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
                Confirm Password
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
              CREATE ACCOUNT
            </button>

            <p className="auth__switch">
              Already have an account?{" "}
              <Link to="/login" className="auth__switch-link">
                Login
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Register;
