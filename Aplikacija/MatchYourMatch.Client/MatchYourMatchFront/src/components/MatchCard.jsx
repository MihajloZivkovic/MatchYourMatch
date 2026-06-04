function MatchCard({ match, variant = 'strip', onMatch, className = '' }) {
  const { name, compatibility, interests, initials } = match;

  if (variant === 'compact') {
    return (
      <article className={`match-card match-card--compact ${className}`}>
        <div className="match-card__avatar match-card__avatar--sm">{initials}</div>
        <div className="match-card__compact-body">
          <h4 className="match-card__name match-card__name--sm">{name}</h4>
          <span className="match-card__compat">{compatibility}%</span>
        </div>
        <button type="button" className="match-card__view-btn">
          VIEW
        </button>
      </article>
    );
  }

  return (
    <article className={`match-card match-card--strip ${className}`}>
      <span className="match-card__badge">{compatibility}%</span>
      <div className="match-card__avatar">{initials}</div>
      <h3 className="match-card__name">{name}</h3>
      <div className="match-card__tags">
        {interests.slice(0, 3).map((tag) => (
          <span key={tag} className="match-card__tag">
            {tag}
          </span>
        ))}
      </div>
      <button type="button" className="match-card__match-btn" onClick={onMatch}>
        MATCH
      </button>
    </article>
  );
}

export default MatchCard;
