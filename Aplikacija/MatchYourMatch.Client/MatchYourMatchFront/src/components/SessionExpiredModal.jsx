import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import {
  getSessionReturnUrl,
  isSessionExpired,
  resetSessionExpired,
  SESSION_EVENT,
} from '../services/sessionExpiry';
import './SessionExpiredModal.css';

export default function SessionExpiredModal() {
  const [open, setOpen] = useState(isSessionExpired);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(SESSION_EVENT, show);
    return () => window.removeEventListener(SESSION_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    buttonRef.current?.focus();
    const trapFocus = (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className='session-expired' role='presentation'>
      <section
        className='session-expired__card'
        role='alertdialog'
        aria-modal='true'
        aria-labelledby='session-expired-title'
        aria-describedby='session-expired-text'
      >
        <span className='session-expired__icon'>
          <Clock3 size={25} />
        </span>
        <h2 id='session-expired-title'>{t('sessionExpired.title')}</h2>
        <p id='session-expired-text'>{t('sessionExpired.message')}</p>
        <button
          ref={buttonRef}
          type='button'
          onClick={() => {
            const returnUrl = getSessionReturnUrl();
            resetSessionExpired();
            setOpen(false);
            navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, {
              replace: true,
            });
          }}
        >
          {t('sessionExpired.action')}
        </button>
      </section>
    </div>,
    document.body,
  );
}
