import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

function About() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="page-fade-in">
      <main className="page__main page__main--about">
        <div className="about">
          {/* Section 1 — Hero statement */}
          <section className="about-hero" aria-labelledby="about-heading">
            <h1 id="about-heading" className="about-hero__heading about-animate about-animate--up">
              {t('aboutPage.heading').split('\n').map((line, index, lines) => (
                <span key={line} className={index === lines.length - 1 ? 'about-hero__accent' : undefined}>
                  {line}{index < lines.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="about-hero__body about-animate about-animate--up about-animate--delay-15">
              {t('aboutPage.intro')}
            </p>
          </section>

          {/* Section 2 — Three pillars */}
          <section className="about-pillars" aria-label={t('aboutPage.pillars')}>
            <article className="about-pillar about-animate about-animate--up about-animate--delay-10">
              <span className="about-pillar__icon" aria-hidden="true">
                01
              </span>
              <h2 className="about-pillar__title">{t('aboutPage.discover').toUpperCase()}</h2>
              <p className="about-pillar__text">
                {t('aboutPage.discoverText')}
              </p>
            </article>

            <article className="about-pillar about-pillar--featured about-animate about-animate--up about-animate--delay-25">
              <span className="about-pillar__icon" aria-hidden="true">
                02
              </span>
              <h2 className="about-pillar__title">{t('aboutPage.connect').toUpperCase()}</h2>
              <p className="about-pillar__text">
                {t('aboutPage.connectText')}
              </p>
            </article>

            <article className="about-pillar about-animate about-animate--up about-animate--delay-40">
              <span className="about-pillar__icon" aria-hidden="true">
                03
              </span>
              <h2 className="about-pillar__title">{t('aboutPage.experience').toUpperCase()}</h2>
              <p className="about-pillar__text">
                {t('aboutPage.experienceText')}
              </p>
            </article>
          </section>

          {/* Section 3 — Manifesto quote */}
          <section className="about-quote" aria-label="Manifesto">
            <div className="about-quote__line" aria-hidden="true" />
            <blockquote className="about-quote__text about-animate about-animate--fade about-animate--delay-20">
              “Happiness is only real when shared.”
            </blockquote>
            <p className="about-quote__attrib about-animate about-animate--fade about-animate--delay-20">
              — Christopher McCandless
            </p>
            <div className="about-quote__line" aria-hidden="true" />
          </section>

          {/* Section 4 — Stats */}
          <section className="about-stats" aria-label="Platform statistics">
            <div className="about-stat about-animate about-animate--up about-animate--delay-10">
              <span className="about-stat__number">TBD</span>
              <span className="about-stat__label">{t('aboutPage.users')}</span>
            </div>
            <div className="about-stat about-animate about-animate--up about-animate--delay-20">
              <span className="about-stat__number">TBD</span>
              <span className="about-stat__label">{t('aboutPage.events')}</span>
            </div>
            <div className="about-stat about-animate about-animate--up about-animate--delay-30">
              <span className="about-stat__number">TBD</span>
              <span className="about-stat__label">{t('aboutPage.matchRate')}</span>
            </div>
          </section>

          {/* Section 5 — CTA strip */}
          <section className="about-cta" aria-labelledby="about-cta-heading">
            <h2 id="about-cta-heading" className="about-cta__heading about-animate about-animate--fade">
              {t('aboutPage.ready').toUpperCase()}
            </h2>
            <button
              type="button"
              className="btn btn--primary about-cta__btn about-animate about-animate--fade"
              onClick={() => navigate('/register')}
            >
              {t('aboutPage.started').toUpperCase()}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

export default About;
