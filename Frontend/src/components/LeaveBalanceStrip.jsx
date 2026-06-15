import { buildLeaveBalanceCards } from '../utils/leaveBalance.js';

const leaveToneColors = {
  blue: '#0f9f9a',
  green: '#10b981',
  orange: '#f59e0b',
  pink: '#e85d75',
};

function LeaveBalanceStrip({ summary, className = '' }) {
  const cards = buildLeaveBalanceCards(summary);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div
      className={`leave-balance-strip ${className}`.trim()}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '0.8rem',
        alignItems: 'stretch',
      }}
    >
      {cards.map((card) => (
        <article
          key={card.title}
          className="leave-balance-card"
          style={{
            minWidth: 0,
            minHeight: '146px',
            padding: '0.95rem 1rem',
            color: leaveToneColors[card.tone] || leaveToneColors.blue,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(246, 251, 250, 0.92))',
            boxShadow: '0 16px 36px rgba(24, 35, 47, 0.08)',
            border: '1px solid rgba(201, 221, 221, 0.88)',
          }}
          >
          <div className="leave-balance-card-icon">
            <i className={card.icon} aria-hidden="true" />
          </div>
          <div className="leave-balance-card-content">
            <strong style={{ marginBottom: '0.5rem' }}>{card.title}</strong>
            {(() => {
              const [mainValue, ...restValue] = String(card.value || '').split(' ');
              return (
            <div className="leave-balance-card-value" style={{ marginBottom: '0.45rem' }}>
                <b>{mainValue}</b>
                <small>{restValue.join(' ')}</small>
              </div>
              );
            })()}
            <p style={{ marginTop: '0.1rem' }}>{card.delta}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default LeaveBalanceStrip;
