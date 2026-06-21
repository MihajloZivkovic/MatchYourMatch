import { useEffect, useRef, useState } from 'react';
import { EyeOff, Flag, MoreHorizontal, ShieldBan } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ReportUserModal from './ReportUserModal';
import { safetyService } from '../services/safetyService';
import './UserActionsMenu.css';
import { useTranslation } from '../hooks/useTranslation';

export default function UserActionsMenu({ userId, username, context='profile', allowHide=true, onBlocked, onHidden, className='' }) {
  const { t } = useTranslation();
  const [open,setOpen]=useState(false), [pending,setPending]=useState(null), [report,setReport]=useState(false), [error,setError]=useState(''); const ref=useRef(null);
  useEffect(()=>{ if(!open)return; const close=e=>{if(e.key==='Escape'||(ref.current&&!ref.current.contains(e.target)))setOpen(false)}; document.addEventListener('mousedown',close); window.addEventListener('keydown',close); return()=>{document.removeEventListener('mousedown',close);window.removeEventListener('keydown',close)}},[open]);
  const run=async()=>{setError('');try{if(pending==='block'){await safetyService.block(userId);onBlocked?.(userId);window.dispatchEvent(new CustomEvent('mym:user-blocked',{detail:{userId}}));}else{await safetyService.hide(userId);onHidden?.(userId);window.dispatchEvent(new CustomEvent('mym:user-hidden',{detail:{userId}}));}setPending(null);}catch(e){setError(e.message)}};
  return <div className={`user-actions ${className}`} ref={ref}><button type="button" className="user-actions__trigger" aria-label={t('userActions.actions')} aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(v=>!v)}}><MoreHorizontal size={19}/></button>{open&&<div className="user-actions__menu"><button onClick={()=>{setPending('block');setOpen(false)}}><ShieldBan size={15}/>{t('userActions.block')}</button>{allowHide&&<button onClick={()=>{setPending('hide');setOpen(false)}}><EyeOff size={15}/>{t('userActions.hide')}</button>}<button onClick={()=>{setReport(true);setOpen(false)}}><Flag size={15}/>{t('userActions.report')}</button><small>{context}</small></div>}<ConfirmModal isOpen={Boolean(pending)} title={pending==='block'?t('userActions.blockTitle'):t('userActions.hideTitle')} message={`${username}: ${pending==='block'?t('userActions.blockText'):t('userActions.hideText')}`} confirmText={pending==='block'?t('userActions.block'):t('userActions.hide')} variant="danger" errorMessage={error} onConfirm={run} onCancel={()=>{setPending(null);setError('')}}/><ReportUserModal open={report} username={username} onClose={()=>setReport(false)}/></div>;
}
