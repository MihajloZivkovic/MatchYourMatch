import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { reportService } from '../services/reportService';
import { useTranslation } from '../hooks/useTranslation';
import './UserActionsMenu.css';

const reasons = ['Harassment', 'Spam', 'Fake profile', 'Inappropriate content', 'Hate speech', 'Other'];

export default function ReportUserModal({ open, userId, username, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('Harassment');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canSubmit = Boolean(reason) && !loading && (reason !== 'Other' || details.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    setReason('Harassment');
    setDetails('');
    setStatus('');
    setError('');
    setLoading(false);
  }, [open]);

  useEffect(() => { if (!open) return; const close = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [open, onClose]);

  const submit = async event => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const response = await reportService.submit({ reportedUserId: userId, reason, details });
      setStatus(response?.message || t('reports.submittedMessage'));
      window.setTimeout(onClose, 700);
    } catch (submitError) {
      console.error('Submit report failed', { status: submitError.status, body: submitError.body });
      setError(submitError.message || t('reports.submitError'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div className="user-report" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="user-report-title" className="user-report__card" onSubmit={submit}>
        <header className="user-report__header">
          <div>
            <span>{t('userActions.report')}</span>
            <h2 id="user-report-title">{t('reports.reportUser', { username })}</h2>
          </div>
          <button type="button" className="user-report__close" onClick={onClose} aria-label={t('common.close')} disabled={loading}>
            <X size={19} />
          </button>
        </header>
        <label>{t('reports.reason')}
          <select value={reason} onChange={e=>{ setReason(e.target.value); setError(''); }}>
            {reasons.map(value => <option key={value} value={value}>{t(`reports.reasons.${reasonKey(value)}`)}</option>)}
          </select>
        </label>
        <label>{t('reports.details')}
          <textarea rows="4" maxLength={2000} placeholder={t('reports.optionalDetails')} value={details}
            onChange={e=>{ setDetails(e.target.value); setError(''); }} />
        </label>
        <small className="user-report__hint">{details.length}/2000</small>
        {error && <p className="user-report__error">{error}</p>}
        {status && <p className="user-report__success">{t('reports.submittedMessage')}</p>}
        <div className="user-report__actions">
          <button type="button" onClick={onClose} disabled={loading}>{t('common.cancel')}</button>
          <button type="submit" className="user-report__submit" disabled={!canSubmit}>
            {loading ? t('common.working') : t('reports.submit')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function reasonKey(value) {
  return String(value || '').replace(/\s+/g, '').replace(/^[A-Z]/, letter => letter.toLowerCase());
}
