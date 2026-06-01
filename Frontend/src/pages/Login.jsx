import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticateUser, startSession } from '../utils/auth.js';

function Login() {
  const [form, setForm] = useState({ email: '', password: '', twoFactorCode: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [awaitingTwoFactor, setAwaitingTwoFactor] = useState(false);
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const result = await authenticateUser(email, form.password, form.twoFactorCode);

    if (!result.ok) {
      if (result.twoFactorRequired) {
        setAwaitingTwoFactor(true);
        setError(result.message || 'Two-factor verification code required.');
        return;
      }
      setError(result.message);
      return;
    }

    setAwaitingTwoFactor(false);
    navigate(startSession(result.user), { replace: true });
  };

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-pattern pattern-top" />
        <div className="login-pattern pattern-bottom" />
        <div className="login-brand">
          <span>K</span>
          <strong>Kavya HRMS</strong>
        </div>

        <div className="login-visual" aria-hidden="true">
          <div className="floating-avatar avatar-one">HR</div>
          <div className="floating-avatar avatar-two">PM</div>
          <div className="visual-card visual-chart">
            <div className="visual-card-head">
              <span>Active Users</span>
              <strong>24k</strong>
            </div>
            <div className="chart-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="visual-card visual-program">
            <span>Program</span>
            <div className="donut-chart" />
            <small>Daily active users</small>
          </div>
        </div>

        <div className="login-hero-copy">
          <h1>Admin Dashboard</h1>
          <p>Track and manage your HRMS workspace from one elegant command center.</p>
        </div>
      </section>

      <section className="login-card">
        <div className="login-panel">
          <h2>Welcome back</h2>
          <p className="login-copy">Login to continue</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <i className="ri-mail-line" aria-hidden="true" />
              <input
                type="text"
                inputMode="email"
                autoComplete="email"
                placeholder="teamlead@gmail.com"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </label>
            <label className="login-field">
              <i className="ri-lock-line" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </label>
            {awaitingTwoFactor && (
              <label className="login-field">
                <i className="ri-shield-keyhole-line" aria-hidden="true" />
                <input
                  type={showTwoFactor ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit verification code"
                  value={form.twoFactorCode}
                  onChange={(event) => updateField('twoFactorCode', event.target.value.replace(/\D+/g, '').slice(0, 6))}
                />
                <button type="button" onClick={() => setShowTwoFactor((current) => !current)}>
                  {showTwoFactor ? 'Hide' : 'Show'}
                </button>
              </label>
            )}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="primary-btn" type="submit">{awaitingTwoFactor ? 'Verify Code' : 'Login'}</button>
            <a className="login-link" href="#/login">Forgot Password?</a>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Login;
