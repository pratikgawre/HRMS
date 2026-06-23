function DashboardCard({ label, value, delta, tone = 'blue', icon = 'ri-bar-chart-box-line', onClick, isActive = false }) {
  const Wrapper = onClick ? 'button' : 'article';

  return (
    <Wrapper className={`dashboard-card tone-${tone}${onClick ? ' is-clickable' : ''}${isActive ? ' is-active' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="card-icon"><i className={icon} /></div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{delta}</span>
    </Wrapper>
  );
}

export default DashboardCard;


