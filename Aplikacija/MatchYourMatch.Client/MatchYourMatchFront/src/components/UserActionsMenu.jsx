import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, Flag, MoreHorizontal, ShieldBan } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ReportUserModal from './ReportUserModal';
import { safetyService } from '../services/safetyService';
import './UserActionsMenu.css';
import { useTranslation } from '../hooks/useTranslation';

export default function UserActionsMenu({ userId, username, context='profile', allowHide=true, onBlocked, onHidden, className='' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [report, setReport] = useState(false);
  const [error, setError] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const menuWidth = 180;
      const menuHeight = menuRef.current?.offsetHeight || 150;
      const gap = 6;
      const left = Math.max(8, Math.min(trigger.right - menuWidth, window.innerWidth - menuWidth - 8));
      const fitsBelow = trigger.bottom + gap + menuHeight <= window.innerHeight - 8;
      setMenuPosition({ top: fitsBelow ? trigger.bottom + gap : Math.max(8, trigger.top - menuHeight - gap), left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.type === 'mousedown' && !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  const run = async () => {
    setError('');
    try {
      if (pending === 'block') {
        await safetyService.block(userId);
        onBlocked?.(userId);
        window.dispatchEvent(new CustomEvent('mym:user-blocked', { detail: { userId } }));
      } else {
        await safetyService.hide(userId);
        onHidden?.(userId);
        window.dispatchEvent(new CustomEvent('mym:user-hidden', { detail: { userId } }));
      }
      setPending(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const menu = open && createPortal(
    <div ref={menuRef} className="user-actions__menu user-actions__menu--portal" style={menuPosition}>
      <button onClick={() => { setPending('block'); setOpen(false); }}><ShieldBan size={15}/>{t('userActions.block')}</button>
      {allowHide && <button onClick={() => { setPending('hide'); setOpen(false); }}><EyeOff size={15}/>{t('userActions.hide')}</button>}
      <button onClick={() => { setReport(true); setOpen(false); }}><Flag size={15}/>{t('userActions.report')}</button>
      <small>{context}</small>
    </div>,
    document.body,
  );

  return <div className={`user-actions ${className}`}>
    <button ref={triggerRef} type="button" className="user-actions__trigger" aria-label={t('userActions.actions')} aria-expanded={open}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}><MoreHorizontal size={19}/></button>
    {menu}
    <ConfirmModal isOpen={Boolean(pending)} title={pending==='block'?t('userActions.blockTitle'):t('userActions.hideTitle')}
      message={`${username}: ${pending==='block'?t('userActions.blockText'):t('userActions.hideText')}`}
      confirmText={pending==='block'?t('userActions.block'):t('userActions.hide')} variant="danger" errorMessage={error}
      onConfirm={run} onCancel={() => { setPending(null); setError(''); }}/>
    <ReportUserModal open={report} username={username} onClose={() => setReport(false)}/>
  </div>;
}
