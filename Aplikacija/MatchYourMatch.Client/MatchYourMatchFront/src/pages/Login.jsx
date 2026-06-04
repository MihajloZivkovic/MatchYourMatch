import { useActionState, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const [vrstaGreske, setVrstaGreske] = useState("")
  const [state, formAction] = useActionState(handleSubmit, {
    error: null,
    values: { email: "", password: "" }
  })


  async function handleSubmit(prevState, formData) {
    const email = formData.get("email")
    const password = formData.get("password")

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      if (errorMessage === "Pogresan email.") {
        setVrstaGreske("email");
      }
      else {
        setVrstaGreske("password"); //pogresna lozinka
      }

      return {
        error: errorMessage,
        values: { email, password }
      }
    }
    setVrstaGreske("");
    const data = await response.json();

    localStorage.setItem("token", data.accessToken);
    localStorage.setItem('mym_authed', 'true');
    window.dispatchEvent(new Event('tokenChanged'));
    navigate("/app/dashboard");
  }

  return (
    <div className="page-fade-in">
      <main className="page__main page__main--auth">
        <div className="auth">
          <form className="auth__card" action={formAction}>
            <h1 className="auth__title">LOGIN</h1>

            <div className="auth__field">
              <label className="auth__label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className={`auth__input ${vrstaGreske === "email" ? "input-danger" : ""}`}
                type="email"
                name="email"
                placeholder={vrstaGreske === "email" ? "pogresan email" : "you@example.com"}
                autoComplete="email"
                defaultValue={vrstaGreske === "password" ? state.values.email : ""} //ako je greska u lozinci, ostaje mejl na mesto, ako nije onda se brise
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className={`auth__input ${vrstaGreske === "password" ? "input-danger" : ""}`}
                type="password"
                name="password"
                placeholder={vrstaGreske === "password" ? "pogresna lozinka" : "••••••••"}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn--primary auth__submit">
              SIGN IN
            </button>

            <p className="auth__switch">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="auth__switch-link">
                Register
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Login;
