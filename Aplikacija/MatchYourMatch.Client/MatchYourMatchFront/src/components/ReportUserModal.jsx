import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { reportService } from '../services/reportService';
import { useTranslation } from '../hooks/useTranslation';
import './UserActionsMenu.css';

const REPORT_REASONS = [
  'Harassment',
  'Spam',
  'Fake profile',
  'Inappropriate content',
  'Hate speech',
  'Other',
];

export default function ReportUserModal({ open, userId, username, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('Harassment');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) return;
    const close = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setReason('Harassment');
    setDetails('');
    setSubmitting(false);
    setError('');
    setSuccess('');
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || !userId) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await reportService.submit({
        reportedUserId: Number(userId),
        reason,
        details: details.trim(),
      });
      setSuccess(t('reports.submittedMessage'));
      window.setTimeout(onClose, 700);
    } catch (submitError) {
      setError(submitError.message || t('reports.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div
      className='user-report'
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role='dialog'
        aria-modal='true'
        className='user-report__card'
        onSubmit={submit}
      >
        <h2>{t('reports.reportUser', { username })}</h2>
        <label>
          {t('reports.reason')}
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((value) => (
              <option key={value} value={value}>
                {t(`reports.reasons.${reasonKey(value)}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('reports.details')}
          <textarea
            rows='4'
            value={details}
            maxLength={2000}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={t('reports.optionalDetails')}
          />
        </label>
        <span className='user-report__hint'>{details.length}/2000</span>
        {error && <p className='user-report__error'>{error}</p>}
        {success && <p className='user-report__success'>{success}</p>}
        <div className='user-report__actions'>
          <button type='button' onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button
            type='submit'
            className='user-report__submit'
            disabled={
              submitting ||
              !userId ||
              (reason === 'Other' && !details.trim())
            }
          >
            {submitting ? t('common.loading') : t('reports.submit')}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function reasonKey(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}
