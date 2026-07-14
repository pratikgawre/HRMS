import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../utils/auth.js';

function ForgotPasswordToast({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  const tone = toast.tone || 'success';
  const iconClassName = tone === 'error'
    ? 'ri-error-warning-line'
    : tone === 'notice'
      ? 'ri-mail-send-line'
      : 'ri-checkbox-circle-fill';
  const label = tone === 'error' ? 'Warning' : tone === 'notice' ? 'Notice' : 'Success';
  const toastMarkup = (
    <div className={`project-toast is-${tone}`} role="status" aria-live="polite">
      <span className="project-toast__icon" aria-hidden="true">
        <i className={iconClassName} />
      </span>
      <div className="project-toast__copy">
        <span>{label}</span>
        <strong>{toast.text}</strong>
      </div>
      <button type="button" className="project-toast__close" onClick={onClose} aria-label="Dismiss notification">
        <i className="ri-close-line" aria-hidden="true" />
      </button>
      <span className="project-toast__accent" aria-hidden="true" />
    </div>
  );

  let portalRoot = document.querySelector('.project-toast-portal');
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.className = 'project-toast-portal';
    document.body.appendChild(portalRoot);
  }

  return createPortal(toastMarkup, portalRoot);
}

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [toast]);

  const handleRequest = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      setToast(null);
      return;
    }

    setSending(true);
    setError('');
    setToast(null);

    const result = await requestPasswordReset(normalizedEmail);
    setSending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    const resolvedEmail = result.email || normalizedEmail;
    setEmail(resolvedEmail);
    setResetToken(result.resetToken || '');
    setExpiresAt(result.expiresAt || '');
    setToast({
      text: result.message || `Reset code sent to ${resolvedEmail}.`,
      tone: result.emailSent ? 'success' : 'notice',
    });
  };

  const handleReset = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !resetToken.trim()) {
      setError('Please request a reset code first.');
      setToast(null);
      return;
    }

    if (newPassword.trim().length < 6) {
      setError('Password must be at least 6 characters long.');
      setToast(null);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setToast(null);
      return;
    }

    setUpdating(true);
    setError('');
    setToast(null);

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
      <ForgotPasswordToast toast={toast} onClose={() => setToast(null)} />

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
          <p className="login-copy">Use your official mail ID to request a reset code, then update the password.</p>

          <form className="login-form" onSubmit={handleRequest}>
            <label className="login-field">
              <i className="ri-mail-line" aria-hidden="true" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="yourname@kavyainfoweb.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
              />
            </label>
            <small className="login-hint">Use your official mail ID.</small>
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
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError('');
                }}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowNewPassword((current) => !current)}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                <i className={showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
              </button>
            </label>
            <label className="login-field">
              <i className="ri-lock-password-line" aria-hidden="true" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError('');
                }}
              />
              <button
                type="button"
                className="password-visibility-toggle"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                <i className={showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
              </button>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
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