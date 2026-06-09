import { useEffect, useMemo, useState } from 'react';

const REPLACEMENT_REASONS = ['Damaged', 'Not Working', 'Upgrade Required', 'Other'];
const REPAIR_ISSUES = ['Hardware Fault', 'Software Issue', 'Battery Issue', 'Screen Damage', 'Connectivity Issue', 'Other'];

const CONFIG = {
  replacement: {
    title: 'Request Replacement',
    submitLabel: 'Submit Request',
    statusLabel: 'Pending',
    icon: 'ri-refresh-line',
  },
  repair: {
    title: 'Request Repair',
    submitLabel: 'Submit Request',
    statusLabel: 'Pending',
    icon: 'ri-tools-line',
  },
  return: {
    title: 'Return Asset',
    submitLabel: 'Submit Request',
    statusLabel: 'Pending Approval',
    icon: 'ri-loop-right-line',
  },
};

function AssetRequestModal({ type, asset, onClose, onSubmit }) {
  const config = CONFIG[type];
  const [draft, setDraft] = useState(() => buildInitialDraft(type, asset));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft(buildInitialDraft(type, asset));
    setErrors({});
  }, [asset, type]);

  const canSubmit = useMemo(() => {
    return validateDraft(type, draft).isValid;
  }, [draft, type]);

  if (!config || !asset) {
    return null;
  }

  const handleChange = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      handleChange('screenshot', '');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      handleChange('screenshot', dataUrl);
    } catch {
      handleChange('screenshot', '');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validateDraft(type, draft);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit({
      ...draft,
      requestType: type,
      asset,
    });
  };

  return (
    <div className="payroll-modal-backdrop asset-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section className="payroll-modal asset-modal" role="dialog" aria-modal="true" aria-label={config.title}>
        <div className="payroll-modal-head">
          <div>
            <p className="eyebrow">Employee Asset</p>
            <h3>{config.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close request form">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <form className="salary-form asset-request-form" onSubmit={handleSubmit}>
          <label className="field full">
            <span>Asset</span>
            <input value={`${asset.assetName} (${asset.assetCode})`} disabled readOnly />
          </label>

          {type === 'replacement' && (
            <>
              <label className="field">
                <span>Replacement Reason</span>
                <select value={draft.reason} onChange={(event) => handleChange('reason', event.target.value)}>
                  <option value="">Select reason</option>
                  {REPLACEMENT_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.reason && <small>{errors.reason}</small>}
              </label>
              <label className="field full">
                <span>Description</span>
                <textarea
                  rows="4"
                  value={draft.description}
                  onChange={(event) => handleChange('description', event.target.value)}
                  placeholder="Explain the replacement requirement"
                />
                {errors.description && <small>{errors.description}</small>}
              </label>
              <label className="field full file-field">
                <span>Screenshot Upload</span>
                <input type="file" accept="image/*" onChange={handleFile} />
                <em>Optional. PNG, JPG, or WEBP image.</em>
              </label>
            </>
          )}

          {type === 'repair' && (
            <>
              <label className="field">
                <span>Issue Type</span>
                <select value={draft.issueType} onChange={(event) => handleChange('issueType', event.target.value)}>
                  <option value="">Select issue type</option>
                  {REPAIR_ISSUES.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.issueType && <small>{errors.issueType}</small>}
              </label>
              {draft.issueType === 'Other' && (
                <label className="field">
                  <span>Issue Details</span>
                  <input
                    value={draft.customIssue}
                    onChange={(event) => handleChange('customIssue', event.target.value)}
                    placeholder="Describe the issue"
                  />
                  {errors.customIssue && <small>{errors.customIssue}</small>}
                </label>
              )}
              <label className="field full">
                <span>Description</span>
                <textarea
                  rows="4"
                  value={draft.description}
                  onChange={(event) => handleChange('description', event.target.value)}
                  placeholder="Explain the repair requirement"
                />
                {errors.description && <small>{errors.description}</small>}
              </label>
              <label className="field full file-field">
                <span>Screenshot Upload</span>
                <input type="file" accept="image/*" onChange={handleFile} />
                <em>Optional. Add a photo if it helps explain the fault.</em>
              </label>
            </>
          )}

          {type === 'return' && (
            <>
              <label className="field full">
                <span>Return Reason</span>
                <textarea
                  rows="3"
                  value={draft.returnReason}
                  onChange={(event) => handleChange('returnReason', event.target.value)}
                  placeholder="Why are you returning this asset?"
                />
                {errors.returnReason && <small>{errors.returnReason}</small>}
              </label>
              <label className="field full">
                <span>Remarks</span>
                <textarea
                  rows="4"
                  value={draft.remarks}
                  onChange={(event) => handleChange('remarks', event.target.value)}
                  placeholder="Add any handover or collection notes"
                />
                {errors.remarks && <small>{errors.remarks}</small>}
              </label>
            </>
          )}

          <div className="salary-form-actions">
            <button className="payroll-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="payroll-primary" type="submit" disabled={!canSubmit}>
              <i className={config.icon} aria-hidden="true" />
              {config.submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function buildInitialDraft(type, asset) {
  return {
    assetId: asset?.id || '',
    assetName: asset?.assetName || '',
    assetCode: asset?.assetCode || '',
    reason: '',
    description: '',
    screenshot: '',
    issueType: '',
    customIssue: '',
    returnReason: '',
    remarks: '',
  };
}

function validateDraft(type, draft) {
  const errors = {};

  if (type === 'replacement') {
    if (!draft.reason) {
      errors.reason = 'Please select a replacement reason.';
    }
    if (!draft.description.trim()) {
      errors.description = 'Please add a short description.';
    }
  }

  if (type === 'repair') {
    if (!draft.issueType) {
      errors.issueType = 'Please select an issue type.';
    }
    if (draft.issueType === 'Other' && !draft.customIssue.trim()) {
      errors.customIssue = 'Please describe the issue.';
    }
    if (!draft.description.trim()) {
      errors.description = 'Please add a short description.';
    }
  }

  if (type === 'return') {
    if (!draft.returnReason.trim()) {
      errors.returnReason = 'Please add a return reason.';
    }
    if (!draft.remarks.trim()) {
      errors.remarks = 'Please add remarks for handover.';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function buildRequestPayload({ type, asset, draft, requestId, requestDate }) {
  const requestTypeLabel = type === 'replacement'
    ? 'Replacement'
    : type === 'repair'
      ? 'Repair'
      : 'Return';

  const reason = type === 'replacement'
    ? draft.reason
    : type === 'return'
      ? draft.returnReason
      : draft.issueType === 'Other'
        ? draft.customIssue
        : draft.issueType;

  return {
    id: requestId,
    requestId,
    assetId: asset.id,
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    asset,
    requestType: type,
    requestTypeLabel,
    reason: type === 'replacement' ? draft.reason : reason,
    issue: type === 'repair' ? reason : '',
    description: draft.description,
    remarks: draft.remarks,
    screenshot: draft.screenshot,
    requestDate,
    status: type === 'return' ? 'Pending Approval' : 'Pending',
  };
}

export function ReplacementRequestModal(props) {
  return <AssetRequestModal type="replacement" {...props} />;
}

export function RepairRequestModal(props) {
  return <AssetRequestModal type="repair" {...props} />;
}

export function ReturnRequestModal(props) {
  return <AssetRequestModal type="return" {...props} />;
}

export default AssetRequestModal;
