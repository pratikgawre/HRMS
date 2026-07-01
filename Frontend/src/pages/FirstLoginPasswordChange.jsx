import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../utils/auth.js';
import { getSessionValue, setSessionValue } from '../utils/appSession.js';
import { getDashboardPath } from '../utils/role-access.js';
import { syncSessionFromAccessUser } from '../utils/auth.js';

function FirstLoginPasswordChange() {
  const navigate = useNavigate();
  const session = syncSessionFromAccessUser();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!session.ok) {
      navigate('/login', { replace: true });
      return;
    }

    if (!session.mustChangePassword) {
      navigate(session.dashboardPath || getDashboardPath(session.user?.role || getSessionValue('kavyaAccessRole')), { replace: true });
    }
  }, [navigate, session]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (newPassword.trim().length < 8) {
      setError('Password must be at least 8 characters long.');
      setInfo('');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setInfo('');
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');

    const result = await changePassword(newPassword, confirmPassword);
    setSaving(false);

    if (!result.ok) {
      setError(result.message || 'Unable to update the password.');
      return;
    }

    setSessionValue('kavyaMustChangePassword', false);
    setInfo(result.message || 'Password updated successfully.');

    const dashboardPath = session.dashboardPath || getDashboardPath(session.user?.role || getSessionValue('kavyaAccessRole'));
    window.setTimeout(() => {
      navigate(dashboardPath, { replace: true });
    }, 450);
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
          <div className="visual-card visual-chart reset-chart">
            <div className="visual-card-head">
              <span>First login</span>
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
          <div className="visual-card visual-program reset-card">
            <span>Temporary access</span>
            <div className="donut-chart" />
            <small>Set a permanent password</small>
          </div>
        </div>

        <div className="login-hero-copy">
          <h1>Complete your setup</h1>
          <p>Set a new password for <strong>{session.user?.employeeName || session.user?.email || 'your account'}</strong> before continuing.</p>
        </div>
      </section>

      <section className="login-card">
        <div className="login-panel login-panel--reset">
          <h2>Change password</h2>
          <p className="login-copy">Your temporary login is active. Create a permanent password now.</p>

          <form className="login-form" onSubmit={handleSubmit}>
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
              <button type="button" onClick={() => setShowNewPassword((current) => !current)}>
                {showNewPassword ? 'Hide' : 'Show'}
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
              <button type="button" onClick={() => setShowConfirmPassword((current) => !current)}>
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}
            {info && <p className="login-status" role="status">{info}</p>}
            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Update password'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default FirstLoginPasswordChange;