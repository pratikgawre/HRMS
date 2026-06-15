function RequestHistoryTable({
  title,
  workflow,
  rows,
  emptyMessage,
  renderAsset,
  renderReason,
  renderIssue,
}) {
  return (
    <div className="table-card asset-table-card">
      <div className="asset-table-head">
        <div>
          <h4>{title}</h4>
          {workflow ? <p>{workflow}</p> : null}
        </div>
      </div>
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Asset</th>
              <th>{renderIssue ? 'Issue' : 'Reason'}</th>
              <th>Request Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={5}>
                  <EmptyRequestState title={emptyMessage} />
                </td>
              </tr>
            )}
            {rows.map((request) => (
              <tr key={request.id}>
                <td data-label="Request ID">
                  <strong>{request.requestId}</strong>
                </td>
                <td data-label="Asset">
                  {renderAsset ? renderAsset(request) : request.assetName}
                </td>
                <td data-label={renderIssue ? 'Issue' : 'Reason'}>
                  {renderIssue ? renderIssue(request) : renderReason(request)}
                </td>
                <td data-label="Request Date">{request.requestDate}</td>
                <td data-label="Status">
                  <span className={`status status-${statusClassName(request.status)}`}>{request.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyRequestState({ title }) {
  return (
    <div className="asset-empty-state asset-empty-state--request">
      <span className="asset-empty-icon">
        <i className="ri-file-list-3-line" aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>Submitted requests will appear here automatically once they are created.</p>
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

export function ReplacementRequestTable(props) {
  return (
    <RequestHistoryTable
      title="Replacement Requests"
      workflow=""
      renderReason={(request) => request.reason}
      {...props}
    />
  );
}

export function RepairRequestTable(props) {
  return (
    <RequestHistoryTable
      title="Repair Requests"
      workflow=""
      renderIssue={(request) => request.issue}
      {...props}
    />
  );
}

export function ReturnRequestTable(props) {
  return (
    <RequestHistoryTable
      title="Return Requests"
      workflow=""
      renderReason={(request) => request.reason}
      {...props}
    />
  );
}

export default RequestHistoryTable;
