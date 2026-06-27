import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { reportService } from '../services/reportService';
import { useTranslation } from '../hooks/useTranslation';
import './ReportHistoryModal.css';

const PAGE_SIZE = 10;

export default function ReportHistoryModal({ open, onClose }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const close = event => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    reportService.history({ page, pageSize: PAGE_SIZE })
      .then(data => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('reports.historyLoadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, page, t]);

  useEffect(() => {
    if (open) setPage(1);
  }, [open]);

  if (!open) return null;

  const items = history?.items || [];
  const totalPages = history?.totalPages || 1;

  return createPortal(
    <div className="report-history-modal" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="report-history-modal__panel" role="dialog" aria-modal="true" aria-labelledby="report-history-title">
        <header className="report-history-modal__header">
          <div>
            <span>MYM</span>
            <h2 id="report-history-title">{t('reports.historyTitle')}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </header>

        <div className="report-history-modal__body">
          {loading && !history && <p className="report-history-modal__state">{t('common.loading')}</p>}
          {error && <p className="report-history-modal__error">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="report-history-modal__state">{t('reports.historyEmpty')}</p>
          )}
          {items.length > 0 && (
            <div className="report-history-modal__list">
              {items.map(report => (
                <article key={report.id} className="report-history-modal__item">
                  <div className="report-history-modal__person">
                    <div>
                      <strong>{report.reportedDisplayName || `@${report.reportedUsername}`}</strong>
                      <span>@{report.reportedUsername}</span>
                    </div>
                    <em>{t('reports.reportedUser')}</em>
                  </div>
                  <dl>
                    <div><dt>{t('reports.reason')}</dt><dd>{t(`reports.reasons.${reasonKey(report.reason)}`)}</dd></div>
                    <div><dt>{t('reports.status')}</dt><dd><span className={`report-history-modal__badge report-history-modal__badge--${statusKey(report.status)}`}>{t(`reports.statuses.${statusKey(report.status)}`)}</span></dd></div>
                    <div><dt>{t('reports.submitted')}</dt><dd>{formatDate(report.createdAt)}</dd></div>
                  </dl>
                  {report.details && <p><span>{t('reports.details')}:</span> {report.details}</p>}
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="report-history-modal__footer">
          <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))}
            disabled={loading || page <= 1}>{t('common.previous')}</button>
          <span>{t('common.page')} {page} {t('common.of')} {totalPages}</span>
          <button type="button" onClick={() => setPage(value => Math.min(totalPages, value + 1))}
            disabled={loading || page >= totalPages}>{t('common.next')}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function reasonKey(value) {
  return String(value || '').replace(/\s+/g, '').replace(/^[A-Z]/, letter => letter.toLowerCase());
}

function statusKey(value) {
  return String(value || '').replace(/\s+/g, '').replace(/^[A-Z]/, letter => letter.toLowerCase());
}
