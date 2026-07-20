import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authenticateUser, startSession } from '../utils/auth.js';
import { normalizeBackendAssetUrl } from '../utils/runtime-config.js';

const loginLogoUrl = normalizeBackendAssetUrl('/uploads/profile-photos/ADMIN-001-ec285d7c-33ae-47cc-91e3-0ef24ad3accb.png');

function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const loginIdentifier = form.email.trim();

    if (isSubmitting) {
      return;
    }

    if (!loginIdentifier || !form.password) {
      setError('Please enter your login ID and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await authenticateUser(loginIdentifier, form.password);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      navigate(startSession(result.user), { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-pattern pattern-top" />
        <div className="login-pattern pattern-bottom" />
        <div className="login-brand login-brand--logo">
          <div className="login-brand-logo-frame" aria-hidden="true">
            <img className="login-brand-logo" src={loginLogoUrl} alt="" />
          </div>
          <strong>Kavya HR 360</strong>
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
          <p className="login-copy">Login with email, employee ID, or user ID</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <i className="ri-mail-line" aria-hidden="true" />
              <input
                type="text"
                inputMode="text"
                autoComplete="username"
                placeholder="teamlead@gmail.com or KV003"
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
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
              </button>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="primary-btn" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
            <Link className="login-link" to="/forgot-password">Forgot Password?</Link>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Login;
