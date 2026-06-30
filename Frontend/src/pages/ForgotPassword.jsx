import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../utils/auth.js';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  const handleRequest = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      setInfo('');
      return;
    }

    setSending(true);
    setError('');
    setInfo('');

    const result = await requestPasswordReset(normalizedEmail);
    setSending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setEmail(result.email || normalizedEmail);
    setResetToken(result.resetToken || '');
    setExpiresAt(result.expiresAt || '');
    setInfo(result.message || `Reset code sent to ${result.email || normalizedEmail}.`);
  };

  const handleReset = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !resetToken.trim()) {
      setError('Please request a reset code first.');
      setInfo('');
      return;
    }

    if (newPassword.trim().length < 6) {
      setError('Password must be at least 6 characters long.');
      setInfo('');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setInfo('');
      return;
    }

    setUpdating(true);
    setError('');
    setInfo('');

    const result = await resetPassword(normalizedEmail, resetToken.trim(), newPassword);
    setUpdating(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate('/login', {
      replace: true,
      state: {
        email: normalizedEmail,
        flashMessage: 'Password updated successfully. Please login with your new password.',
      },
    });
  };

  return (
    <main className="login-page reset-page">
      <section className="login-hero reset-hero">
        <div className="login-pattern pattern-top" />
        <div className="login-pattern pattern-bottom" />
        <div className="login-brand">
          <span>K</span>
          <strong>Kavya HRMS</strong>
        </div>

        <div className="login-visual reset-visual" aria-hidden="true">
          <div className="floating-avatar avatar-one">PW</div>
          <div className="floating-avatar avatar-two">ID</div>
          <div className="visual-card visual-program reset-card">
            <span>Secure Access</span>
            <div className="donut-chart" />
            <small>Email delivery for reset codes</small>
          </div>
          <div className="visual-card visual-chart reset-chart">
            <div className="visual-card-head">
              <span>Account Access</span>
              <strong>Secure</strong>
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
        </div>

        <div className="login-hero-copy">
          <h1>Reset your password</h1>
          <p>Request a code by email, then set a fresh password for your account.</p>
        </div>
      </section>

      <section className="login-card">
        <div className="login-panel login-panel--reset">
          <h2>Forgot password</h2>
          <p className="login-copy">Use your email to request a reset code, then update the password.</p>

          <form className="login-form" onSubmit={handleRequest}>
            <label className="login-field">
              <i className="ri-mail-line" aria-hidden="true" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
              />
            </label>
            <button className="primary-btn" type="submit" disabled={sending}>
              {sending ? 'Sending code...' : 'Send reset code'}
            </button>
          </form>

          {resetToken && (
            <div className="reset-token-card">
              <span className="reset-token-label">Local reset code</span>
              <strong className="reset-token-code">{resetToken}</strong>
              <small>{expiresAt ? `Expires at ${new Date(expiresAt).toLocaleString()}` : 'Code is valid for a short time.'}</small>
            </div>
          )}

          <form className="login-form" onSubmit={handleReset}>
            <label className="login-field">
              <i className="ri-key-2-line" aria-hidden="true" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Reset code"
                value={resetToken}
                onChange={(event) => {
                  setResetToken(event.target.value);
                  setError('');
                }}
              />
            </label>
            <label className="login-field">
              <i className="ri-lock-password-line" aria-hidden="true" />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError('');
                }}
              />
            </label>
            <label className="login-field">
              <i className="ri-lock-password-line" aria-hidden="true" />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError('');
                }}
              />
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            {info && <p className="login-status" role="status">{info}</p>}
            <button className="primary-btn" type="submit" disabled={updating}>
              {updating ? 'Updating...' : 'Update password'}
            </button>
          </form>

          <Link className="login-link" to="/login">Back to login</Link>
        </div>
      </section>
    </main>
  );
}

export default ForgotPassword;
