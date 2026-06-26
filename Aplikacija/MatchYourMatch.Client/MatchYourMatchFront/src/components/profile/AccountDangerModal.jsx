import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, PauseCircle, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { clearAuthSession } from '../../services/authSession';
import { accountService } from '../../services/accountService';
import './AccountDangerModal.css';

export default function AccountDangerModal({ onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState('choose');
  const [status, setStatus] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    accountService
      .status()
      .then(setStatus)
      .catch((requestError) => setError(requestError.message));
  }, []);

  const requiredConfirmation = mode === 'delete' ? 'DELETE' : 'DEACTIVATE';
  const canSubmit =
    Boolean(status) &&
    !loading &&
    (!status.hasPassword || password.length > 0) &&
    confirmation === requiredConfirmation;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'delete')
        await accountService.delete({ password, confirmation });
      else await accountService.deactivate({ password, confirmation });
      clearAuthSession();
      navigate('/login', {
        replace: true,
        state: {
          accountMessage: t(
            mode === 'delete'
              ? 'accountLifecycle.deleted'
              : 'accountLifecycle.deactivated',
          ),
        },
      });
    } catch (requestError) {
      setError(requestError.message);
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className='account-danger'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        className='account-danger__dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='account-danger-title'
      >
        <header>
          <div>
            <span>{t('profileSettings.danger')}</span>
            <h2 id='account-danger-title'>{t('accountLifecycle.title')}</h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            disabled={loading}
            aria-label={t('common.cancel')}
          >
            <X size={20} />
          </button>
        </header>
        {mode === 'choose' ? (
          <div className='account-danger__choices'>
            <p>{t('accountLifecycle.choose')}</p>
            <button type='button' onClick={() => setMode('deactivate')}>
              <PauseCircle />
              <span>
                <strong>{t('accountLifecycle.deactivate')}</strong>
                <small>{t('accountLifecycle.deactivateHint')}</small>
              </span>
            </button>
            <button
              type='button'
              className='is-delete'
              onClick={() => setMode('delete')}
            >
              <Trash2 />
              <span>
                <strong>{t('accountLifecycle.delete')}</strong>
                <small>{t('accountLifecycle.deleteHint')}</small>
              </span>
            </button>
          </div>
        ) : (
          <div className='account-danger__confirm'>
            <AlertTriangle size={30} />
            <h3>
              {t(
                mode === 'delete'
                  ? 'accountLifecycle.delete'
                  : 'accountLifecycle.deactivate',
              )}
            </h3>
            <p>
              {t(
                mode === 'delete'
                  ? 'accountLifecycle.deleteWarning'
                  : 'accountLifecycle.deactivateWarning',
              )}
            </p>
            {status?.hasPassword && (
              <label>
                <span>{t('accountLifecycle.currentPassword')}</span>
                <input
                  type='password'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete='current-password'
                />
              </label>
            )}
            <label>
              <span>
                {t('accountLifecycle.typeToConfirm').replace(
                  '{{value}}',
                  requiredConfirmation,
                )}
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete='off'
              />
            </label>
            {error && (
              <p className='account-danger__error' role='alert'>
                {error}
              </p>
            )}
            <div className='account-danger__actions'>
              <button
                type='button'
                onClick={() => {
                  setMode('choose');
                  setError('');
                }}
                disabled={loading}
              >
                {t('common.back')}
              </button>
              <button
                type='button'
                className='is-danger'
                onClick={submit}
                disabled={!canSubmit}
              >
                {loading
                  ? t('common.working')
                  : t(
                      mode === 'delete'
                        ? 'accountLifecycle.deleteAction'
                        : 'accountLifecycle.deactivateAction',
                    )}
              </button>
            </div>
          </div>
        )}
        {mode === 'choose' && error && (
          <p className='account-danger__error' role='alert'>
            {error}
          </p>
        )}
        {mode === 'choose' && (
          <footer>
            <button type='button' onClick={onClose}>
              {t('common.cancel')}
            </button>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
