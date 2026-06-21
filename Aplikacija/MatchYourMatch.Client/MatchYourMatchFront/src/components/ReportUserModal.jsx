import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import './UserActionsMenu.css';

export default function ReportUserModal({ open, username, onClose }) {
  const [reason, setReason] = useState('Harassment');
  useEffect(() => { if (!open) return; const close = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [open, onClose]);
  if (!open) return null;
  return createPortal(<div className="user-report" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section role="dialog" aria-modal="true" className="user-report__card"><h2>Report @{username}</h2><label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}>{['Harassment','Spam','Fake profile','Inappropriate content','Safety concern','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>Details<textarea rows="4" placeholder="Optional details"/></label><p>Reporting is coming soon.</p><div><button onClick={onClose}>Cancel</button><button disabled>Submit report</button></div></section></div>,document.body);
}
