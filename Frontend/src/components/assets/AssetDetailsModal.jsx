function AssetDetailsModal({ asset, requests = [], onClose }) {
  if (!asset) {
    return null;
  }

  return (
    <div className="payroll-modal-backdrop asset-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section className="payroll-modal asset-modal" role="dialog" aria-modal="true" aria-label="Asset details">
        <div className="payroll-modal-head">
          <div>
            <p className="eyebrow">Asset Details</p>
            <h3>{asset.assetName}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close asset details">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>

        <div className="asset-details-layout">
          <div className="asset-image-card">
            <img src={asset.imageUrl} alt={`${asset.assetName} preview`} />
            <div>
              <strong>{asset.assetName}</strong>
              <span>{asset.assetCode}</span>
            </div>
          </div>

          <div className="asset-details-grid">
            <Detail label="Category" value={asset.category} />
            <Detail label="Brand" value={asset.brand} />
            <Detail label="Model" value={asset.model} />
            <Detail label="Serial Number" value={asset.serialNo} />
            <Detail label="Assigned Date" value={asset.assignedDate} />
            <Detail label="Asset Condition" value={asset.condition} />
            <Detail label="Current Status" value={asset.status} />
            <Detail label="Location" value={asset.location} />
          </div>

          <div className="asset-request-history">
            <div className="asset-table-head">
              <div>
                <h4>Recent Requests</h4>
                <p>Latest request activity for this asset.</p>
              </div>
            </div>
            {requests.length === 0 ? (
              <p className="notification-empty">No requests submitted for this asset yet.</p>
            ) : (
              <ul>
                {requests.slice(0, 4).map((request) => (
                  <li key={request.id}>
                    <strong>{request.requestTypeLabel}</strong>
                    <span>{request.requestDate}</span>
                    <small>{request.status}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="asset-detail-card">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

export default AssetDetailsModal;
