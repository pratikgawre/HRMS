function DataTable({ columns, rows, emptyMessage = 'No records found.', onRowClick, getRowClassName, className = '' }) {
  const handleRowClick = (event, row) => {
    const interactiveElement = event.target.closest('button, a, input, select, textarea, label');
    if (interactiveElement || typeof onRowClick !== 'function') {
      return;
    }

    onRowClick(row);
  };

  const handleRowKeyDown = (event, row) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    if (typeof onRowClick === 'function') {
      onRowClick(row);
    }
  };

  return (
    <div className={`table-card ${className}`.trim()}>
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={columns.length}>{emptyMessage}</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
                className={getRowClassName ? getRowClassName(row) : undefined}
                onClick={(event) => handleRowClick(event, row)}
                onKeyDown={(event) => handleRowKeyDown(event, row)}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} data-label={column.label}>{renderCell(row, column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(row, column) {
  if (typeof column.render === 'function') {
    return column.render(row);
  }

  if (column.key === 'name') {
    return (
      <div className="employee-cell">
        <span>{row.avatar}</span>
        <div>
          <strong>{row.name}</strong>
          <small>{row.id}</small>
        </div>
      </div>
    );
  }

  if (column.key === 'status') {
    return <span className={`status status-${String(row.status).toLowerCase().replaceAll(' ', '-')}`}>{row.status}</span>;
  }

  if (column.key === 'priority') {
    return <span className={`priority priority-${String(row.priority).toLowerCase()}`}>{row.priority}</span>;
  }

  if (column.key === 'progress') {
    const value = Number.parseInt(row.progress, 10) || 0;
    return (
      <div className="progress-cell">
        <span>{row.progress}</span>
        <div className="mini-progress" aria-hidden="true">
          <i style={{ width: `${value}%` }} />
        </div>
      </div>
    );
  }

  return row[column.key];
}

function getRowKey(row, index) {
  const stableParts = [
    row.id,
    row.employeeId,
    row.date,
    row.checkIn,
    row.checkOut,
    row.employee,
    row.name,
  ].filter(Boolean);

  if (stableParts.length === 0) {
    return `row-${index}`;
  }

  return `${stableParts.join('::')}::${index}`;
}

export default DataTable;
