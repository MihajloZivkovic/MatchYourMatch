import { useState } from 'react';
import { X } from 'lucide-react';
import { matches } from '../../data/matches';
import './QuickMatch.css';

function QuickMatch() {
  const [stack, setStack] = useState(matches.slice(0, 3));
  const [animating, setAnimating] = useState(null);

  const top = stack[0];
  const remaining = stack.length;

  const handleAction = (action) => {
    if (!top || animating) return;
    setAnimating(action);
    setTimeout(() => {
      setStack((prev) => prev.slice(1));
      setAnimating(null);
    }, 420);
  };

  if (!top) {
    return (
      <div className="page-fade-in quick-match">
        <div className="quick-match__atmo" aria-hidden="true" />
        <div className="app-empty quick-match__empty-wrap">
          <p className="app-empty__title">You&apos;re all caught up</p>
          <p className="app-empty__text">No more profiles today. Check back tomorrow.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in quick-match">
      <div className="quick-match__atmo" aria-hidden="true">
        <span className="quick-match__glow" />
        <span className="quick-match__vignette" />
      </div>

      <p className="quick-match__status">{remaining} profiles remaining today</p>

      <div className="quick-match__stack">
        {stack
          .slice()
          .reverse()
          .map((profile, i, arr) => {
            const isTop = i === arr.length - 1;
            const depth = arr.length - 1 - i;
            return (
              <article
                key={profile.id}
                className={`quick-match__card${isTop ? ' quick-match__card--top' : ''}${
                  isTop && animating === 'skip' ? ' quick-match__card--skip' : ''
                }${isTop && animating === 'match' ? ' quick-match__card--match' : ''}`}
                style={{ '--depth': depth, zIndex: i + 1 }}
              >
                <span className="quick-match__compat">
                  <span className="quick-match__compat-val">{profile.compatibility}%</span>
                  <span className="quick-match__compat-label">match</span>
                </span>
                <div className="quick-match__avatar">{profile.initials}</div>
                <h2 className="quick-match__name">{profile.name}</h2>
                <p className="quick-match__meta">
                  {profile.age} · {profile.location}
                </p>
                <div className="quick-match__tags">
                  {profile.interests.map((tag) => (
                    <span key={tag} className="quick-match__tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="quick-match__bar-wrap">
                  <div
                    className="quick-match__bar-fill"
                    style={{ width: `${profile.compatibility}%` }}
                  />
                </div>
              </article>
            );
          })}
      </div>

      <div className="quick-match__actions">
        <button
          type="button"
          className="quick-match__btn quick-match__btn--skip app-interactive"
          aria-label="Skip"
          onClick={() => handleAction('skip')}
          disabled={!!animating}
        >
          <X size={22} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="quick-match__btn quick-match__btn--match app-interactive"
          aria-label="Match"
          onClick={() => handleAction('match')}
          disabled={!!animating}
        >
          ♥
        </button>
      </div>
    </div>
  );
}

export default QuickMatch;
