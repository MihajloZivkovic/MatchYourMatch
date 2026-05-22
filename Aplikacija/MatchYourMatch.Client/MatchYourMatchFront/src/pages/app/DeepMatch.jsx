import { useState } from 'react';
import './DeepMatch.css';

const STEPS = [
  {
    question: 'What do you value most in a relationship?',
    options: ['Trust & honesty', 'Adventure & spontaneity', 'Deep conversations', 'Shared goals'],
  },
  {
    question: 'How do you recharge after a long week?',
    options: ['Quiet night in', 'Social outing', 'Creative hobby', 'Outdoor activity'],
  },
  {
    question: 'Your ideal first date looks like…',
    options: ['Coffee & walk', 'Live music', 'Cooking together', 'Museum or gallery'],
  },
  {
    question: 'Conflict style — you tend to…',
    options: ['Talk it through immediately', 'Need space first', 'Find compromise fast', 'Use humor to diffuse'],
  },
  {
    question: 'In five years, you hope your partner and you are…',
    options: ['Building something together', 'Exploring the world', 'Rooted in community', 'Growing individually & together'],
  },
];

const RESULTS = [
  { name: 'Alex Rivera', score: 96, line: 'Shared love of music and honest communication.' },
  { name: 'Jordan Lee', score: 93, line: 'Aligned life goals and adventurous spirit.' },
  { name: 'Taylor Brooks', score: 89, line: 'Creative souls who value deep connection.' },
];

function DeepMatch() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('questions');
  const current = STEPS[step];
  const selected = answers[step];

  const handleSelect = (option) => {
    setAnswers((prev) => ({ ...prev, [step]: option }));
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleFind = () => {
    setPhase('loading');
    setTimeout(() => setPhase('results'), 2000);
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers({});
    setPhase('questions');
  };

  return (
    <div className="page-fade-in deep-match">
      <div className="deep-match__atmo" aria-hidden="true">
        <span className="deep-match__mesh" />
        <span className="deep-match__vignette" />
      </div>
      <div className="deep-match__card">
        <header className="deep-match__header">
          <h1>DEEP MATCH</h1>
          <p>Answer honestly. Match deeply.</p>
          <div className="deep-match__accent-line" />
        </header>

        {phase === 'questions' && (
          <>
            <div className="deep-match__steps" aria-label="Progress">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`deep-match__dot${
                    i < step ? ' deep-match__dot--done' : i === step ? ' deep-match__dot--active' : ''
                  }`}
                />
              ))}
            </div>

            <h2 className="deep-match__question">{current.question}</h2>
            <div className="deep-match__options">
              {current.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`deep-match__option${selected === opt ? ' deep-match__option--selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="deep-match__nav">
              {step > 0 && (
                <button type="button" className="deep-match__back" onClick={handleBack}>
                  ← BACK
                </button>
              )}
              {step < STEPS.length - 1 && selected && (
                <button type="button" className="app-btn-pill deep-match__next" onClick={handleNext}>
                  NEXT →
                </button>
              )}
              {step === STEPS.length - 1 && selected && (
                <button type="button" className="app-btn-pill deep-match__find" onClick={handleFind}>
                  FIND MY MATCHES
                </button>
              )}
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="deep-match__loading">
            <div className="deep-match__spinner" aria-hidden="true" />
            <p>Finding your deepest matches...</p>
          </div>
        )}

        {phase === 'results' && (
          <div className="deep-match__results">
            <h2 className="deep-match__results-title">YOUR MATCHES</h2>
            {RESULTS.map((r) => (
              <article key={r.name} className="deep-match__result">
                <div>
                  <h3>{r.name}</h3>
                  <p>{r.line}</p>
                </div>
                <span className="deep-match__score">{r.score}%</span>
                <button type="button" className="app-btn-pill app-btn-pill--outline">
                  VIEW PROFILE
                </button>
              </article>
            ))}
            <button type="button" className="deep-match__back" onClick={handleRestart}>
              ← Retake questionnaire
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeepMatch;
