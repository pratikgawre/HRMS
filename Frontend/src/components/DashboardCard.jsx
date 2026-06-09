function DashboardCard({ label, value, delta, tone = 'blue', icon = 'ri-bar-chart-box-line', onClick, className = '', style }) {
  const Wrapper = onClick ? 'button' : 'article';

  return (
    <Wrapper className={`dashboard-card tone-${tone}${onClick ? ' is-clickable' : ''} ${className}`.trim()} onClick={onClick} type={onClick ? 'button' : undefined} style={style}>
      <div className="card-icon"><i className={icon} /></div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{delta}</span>
    </Wrapper>
  );
}

export default DashboardCard;


