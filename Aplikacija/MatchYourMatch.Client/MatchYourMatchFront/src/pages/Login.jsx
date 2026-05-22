import { Link, useNavigate } from 'react-router-dom';

// ovo menjamo kako odlucimo
function Login() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('mym_authed', 'true');
    navigate('/app/dashboard');
  };

  return (
    <div className="page-fade-in">
      <main className="page__main page__main--auth">
        <div className="auth">
          <form className="auth__card" onSubmit={handleSubmit}>
            <h1 className="auth__title">LOGIN</h1>

            <div className="auth__field">
              <label className="auth__label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="auth__input"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className="auth__input"
                type="password"
                name="password"
                placeholder="••••••••"
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
