import { useState } from 'react';
import { changePassword, syncSessionFromAccessUser } from '../utils/auth.js';
import { setSessionValue } from '../utils/appSession.js';

function MandatoryPasswordChangeModal() {
  const session = syncSessionFromAccessUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!currentPassword.trim()) {
      setError('Current password is required.');
      setInfo('');
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

    const result = await changePassword(currentPassword, newPassword, confirmPassword);
    setSaving(false);

    if (!result.ok) {
      setError(result.message || 'Unable to update the password.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSessionValue('kavyaMustChangePassword', false);
    setInfo(result.message || 'Password updated successfully.');
  };

  return (
    <div className="password-gate" role="presentation">
      <section
        className="password-gate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-gate-title"
      >
        <span className="password-gate-icon" aria-hidden="true">
          <i className="ri-lock-password-line" />
        </span>
        <div>
          <p className="password-gate-eyebrow">First login security</p>
          <h2 id="password-gate-title">Change your temporary password</h2>
          <p>
            {session.user?.employeeName || session.user?.email || 'This account'} must set a new password before using Kavya HRMS.
          </p>
        </div>

        <form className="login-form password-gate-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <i className="ri-shield-keyhole-line" aria-hidden="true" />
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setError('');
              }}
            />
            <button
              type="button"
              className="password-visibility-toggle"
              onClick={() => setShowCurrentPassword((current) => !current)}
              aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
            >
              <i className={showCurrentPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true" />
            </button>
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
          {info && <p className="login-status" role="status">{info}</p>}
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Update password and continue'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default MandatoryPasswordChangeModal;