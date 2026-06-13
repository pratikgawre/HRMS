function AssetToast({ toast }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`asset-toast asset-toast-${toast.type || 'success'}`} role="status" aria-live="polite">
      <i className={toast.icon || 'ri-checkbox-circle-line'} aria-hidden="true" />
      <div>
        <strong>{toast.title || 'Saved'}</strong>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

export default AssetToast;
