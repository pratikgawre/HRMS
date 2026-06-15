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
    <div className={`leave-balance-strip ${className}`.trim()}>
      {cards.map((card) => (
        <article
          key={card.title}
          className="leave-balance-card"
          style={{ color: leaveToneColors[card.tone] || leaveToneColors.blue }}
        >
          <div className="leave-balance-card-icon">
            <i className={card.icon} aria-hidden="true" />
          </div>
          <div className="leave-balance-card-content">
            <span>{card.label}</span>
            <strong>{card.title}</strong>
            {(() => {
              const [mainValue, ...restValue] = String(card.value || '').split(' ');
              return (
            <div className="leave-balance-card-value">
                <b>{mainValue}</b>
                <small>{restValue.join(' ')}</small>
              </div>
              );
            })()}
            <p>{card.delta}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default LeaveBalanceStrip;
