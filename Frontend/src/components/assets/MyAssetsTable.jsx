import { useEffect, useState } from 'react';

function MyAssetsTable({
  rows,
  onViewDetails,
  onRequestReplacement,
  onRequestRepair,
  onRequestReturn,
}) {
  const [activeActionAsset, setActiveActionAsset] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.asset-action-dropdown-wrap')) {
        setActiveActionAsset(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (assetId) => {
    setActiveActionAsset((prev) => (prev === assetId ? null : assetId));
  };

  const closeDropdown = () => setActiveActionAsset(null);

  return (
    <div className="table-card asset-table-card">
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Asset ID</th>
              <th>Asset Name</th>
              <th>Employee Name</th>
              <th>Category</th>
              <th>Assigned Date</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={8}>
                  <EmptyAssetState
                    icon="ri-briefcase-4-line"
                    title="No assets assigned yet."
                    copy="Your assigned assets will appear here once HR allocates company equipment to your profile."
                  />
                </td>
              </tr>
            )}
            {rows.map((asset) => {
              const assetMeta = [asset.brand, asset.model].filter(Boolean).join(' | ');
              const isOpen = activeActionAsset === asset.id;

              return (
                <tr key={asset.id}>
                  <td data-label="Asset ID">
                    <strong>{asset.assetCode || asset.id}</strong>
                  </td>
                  <td data-label="Asset Name">
                    <div className="asset-row-asset">
                      <img src={asset.imageUrl} alt="" aria-hidden="true" />
                      <div>
                        <strong>{asset.assetName}</strong>
                        <small>{assetMeta || 'Assigned asset'}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Employee Name">{asset.employeeName || asset.assignedTo || '-'}</td>
                  <td data-label="Category">{asset.category}</td>
                  <td data-label="Assigned Date">{asset.assignedDate || '-'}</td>
                  <td data-label="Condition">{asset.condition}</td>
                  <td data-label="Status">
                    <span className={`status status-${statusClassName(asset.status)}`}>{asset.status}</span>
                  </td>
                  <td data-label="Actions">
                    <div className="table-actions asset-action-dropdown-wrap">
                      <button
                        type="button"
                        className="asset-action-toggle"
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        aria-label="Open asset actions"
                        onClick={() => toggleDropdown(asset.id)}
                      >
                        <i className="ri-more-2-line" aria-hidden="true" />
                      </button>
                      {isOpen && (
                        <div className="asset-action-dropdown">
                          <button
                            type="button"
                            onClick={() => {
                              onViewDetails(asset);
                              closeDropdown();
                            }}
                          >
                            <i className="ri-eye-line" aria-hidden="true" />
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onRequestReplacement(asset);
                              closeDropdown();
                            }}
                          >
                            <i className="ri-refresh-line" aria-hidden="true" />
                            Request Replacement
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onRequestRepair(asset);
                              closeDropdown();
                            }}
                          >
                            <i className="ri-tools-line" aria-hidden="true" />
                            Request Repair
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              onRequestReturn(asset);
                              closeDropdown();
                            }}
                          >
                            <i className="ri-loop-right-line" aria-hidden="true" />
                            Return Asset
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyAssetState({ icon, title, copy }) {
  return (
    <div className="asset-empty-state">
      <span className="asset-empty-icon">
        <i className={icon} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function statusClassName(value) {
  return String(value || 'pending')
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll('/', '-')
    .replaceAll(' ', '-');
}

export default MyAssetsTable;
