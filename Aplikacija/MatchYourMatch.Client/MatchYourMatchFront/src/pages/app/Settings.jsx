import { useEffect, useState } from 'react';
import { Bell, Check, Languages, MessagesSquare, Monitor, Moon, Palette, ShieldCheck, SlidersHorizontal, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../../components/UserAvatar';
import { safetyService } from '../../services/safetyService';
import './Settings.css';

const defaults = { maximumDistanceKm: null, showMeInQuickMatch: true, showMeInDeepMatch: true, preferPeopleNearby: true, minAge: null, maxAge: null,
  whoCanMessageMe: 'MatchesOnly', allowEventInvitesFrom: 'PeopleIFollow', allowGroupChatInvitesFrom: 'MatchesOnly', notifyEventInvites: true,
  notifyNewFollowers: true, notifyQuickMatches: true, notifyChatMessages: true, notifyGroupMessages: true, notifyEventDiscussionReplies: true,
  notifyNewEventNearby: true, notifyEventStartingSoon: true, notifyNewMatchNearby: false };
const choices = [['MatchesOnly','Matches only'],['PeopleIFollow','People I follow'],['Followers','Followers'],['Everyone','Everyone']];
const token = () => localStorage.getItem('token');
const numberDraftsFrom = settings => ({
  maximumDistanceKm: settings.maximumDistanceKm?.toString() ?? '',
  minAge: settings.minAge?.toString() ?? '',
  maxAge: settings.maxAge?.toString() ?? ''
});

function Card({ icon: Icon, title, subtitle, children }) {
  return <section className="settings-card"><div className="settings-card__heading"><span className="settings-card__icon"><Icon size={20}/></span><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</section>;
}

function Settings() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [settings, setSettings] = useState(defaults); const [numberDrafts, setNumberDrafts] = useState(numberDraftsFrom(defaults)); const [loading, setLoading] = useState(true); const [message, setMessage] = useState('');
  const [safety, setSafety] = useState(null);
  useEffect(() => { fetch('/api/Settings/me',{headers:{Authorization:`Bearer ${token()}`}}).then(r=>r.ok?r.json():Promise.reject())
    .then(data=>{ setSettings(data); setNumberDrafts(numberDraftsFrom(data)); }).catch(()=>setMessage('Settings could not be loaded.')).finally(()=>setLoading(false)); },[]);
  const save = async next => { const previous=settings; setSettings(next); setMessage('Saving…');
    try { const r=await fetch('/api/Settings/me',{method:'PUT',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify(next)});
      if(!r.ok) throw new Error(); const saved=await r.json(); setSettings(saved); setNumberDrafts(numberDraftsFrom(saved)); setMessage('Saved'); return true; } catch { setSettings(previous); setMessage('Could not save settings.'); return false; } };
  const change = (key,value) => save({...settings,[key]:value});
  const editNumber = (field,value) => setNumberDrafts(current=>({...current,[field]:value}));
  const commitNumbers = () => {
    const parse = value => value.trim()==='' ? null : Number(value);
    const maximumDistanceKm=parse(numberDrafts.maximumDistanceKm), minAge=parse(numberDrafts.minAge), maxAge=parse(numberDrafts.maxAge);
    if ((maximumDistanceKm!==null && (!Number.isInteger(maximumDistanceKm) || maximumDistanceKm<1 || maximumDistanceKm>200)) ||
        (minAge!==null && (!Number.isInteger(minAge) || minAge<16 || minAge>100)) ||
        (maxAge!==null && (!Number.isInteger(maxAge) || maxAge<16 || maxAge>100))) {
      setMessage('Enter valid whole numbers. Ages must be 16–100 and distance 1–200 km.'); return;
    }
    if (minAge!==null && maxAge!==null && minAge>maxAge) { setMessage('Minimum age cannot be greater than maximum age.'); return; }
    save({...settings,maximumDistanceKm,minAge,maxAge});
  };
  const loadSafety = async type => {
    if (safety?.type===type) { setSafety(null); return; }
    try { setSafety({type,items:type==='blocked-users'?await safetyService.blocked():await safetyService.hidden()}); } catch { setSafety({type,items:[]}); }
  };
  const removeSafety = async id => { if(safety.type==='blocked-users') await safetyService.unblock(id); else await safetyService.unhide(id); setSafety({...safety,items:safety.items.filter(x=>x.userId!==id)}); };
  const Toggle=({field,label,help})=><div className="settings-row"><div><strong>{label}</strong><small>{help}</small></div><button className={`settings-switch${settings[field]?' is-on':''}`} onClick={()=>change(field,!settings[field])} aria-pressed={settings[field]}><span/></button></div>;
  const Select=({field,label,allowed=choices})=><label className="settings-row"><strong>{label}</strong><select value={settings[field]} onChange={e=>change(field,e.target.value)}>{allowed.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;
  if(loading) return <div className="settings-page settings-state">Loading settings…</div>;
  return <div className="page-fade-in settings-page"><header className="settings-page__header"><span className="settings-page__eyebrow">MYM</span><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p>{message&&<small className="settings-save-state">{message}</small>}</header><div className="settings-page__grid">
    <Card icon={Palette} title={t('settings.appearance')} subtitle={t('settings.appearanceText')}><div className="settings-options settings-options--three">{[['system',Monitor],['light',Sun],['dark',Moon]].map(([v,Icon])=><button key={v} className={`settings-option${theme===v?' settings-option--selected':''}`} onClick={()=>setTheme(v)}><Icon size={21}/><span>{t(`theme.${v}`)}</span>{theme===v&&<Check className="settings-option__check" size={16}/>}</button>)}</div></Card>
    <Card icon={Languages} title={t('settings.language')} subtitle={t('settings.languageText')}><div className="settings-options">{[['en','EN','language.english'],['sr','SR','language.serbian']].map(([v,c,k])=><button key={v} className={`settings-option${language===v?' settings-option--selected':''}`} onClick={()=>setLanguage(v)}><strong>{c}</strong><span>{t(k)}</span>{language===v&&<Check className="settings-option__check" size={16}/>}</button>)}</div></Card>
    <Card icon={SlidersHorizontal} title="Matching preferences" subtitle="Control how you appear in matching results.">
      <label className="settings-row"><div><strong>Maximum distance (km)</strong><small>{numberDrafts.maximumDistanceKm ? `${numberDrafts.maximumDistanceKm} km` : 'No distance limit'}</small></div><input type="number" min="1" max="200" placeholder="km" aria-label="Maximum distance in kilometers" value={numberDrafts.maximumDistanceKm} onChange={e=>editNumber('maximumDistanceKm',e.target.value)} onBlur={commitNumbers} onKeyDown={e=>e.key==='Enter'&&e.currentTarget.blur()}/></label>
      <div className="settings-age">
        <label>Min age<input type="number" min="16" max="100" value={numberDrafts.minAge} onChange={e=>editNumber('minAge',e.target.value)} onBlur={commitNumbers} onKeyDown={e=>e.key==='Enter'&&e.currentTarget.blur()}/></label>
        <label>Max age<input type="number" min="16" max="100" value={numberDrafts.maxAge} onChange={e=>editNumber('maxAge',e.target.value)} onBlur={commitNumbers} onKeyDown={e=>e.key==='Enter'&&e.currentTarget.blur()}/></label>
      </div>
      <Toggle field="showMeInQuickMatch" label="Show me in Quick Match"/><Toggle field="showMeInDeepMatch" label="Show me in Deep Match"/><Toggle field="preferPeopleNearby" label="Prefer people nearby"/>
    </Card>
    <Card icon={MessagesSquare} title="Messages & contact" subtitle="Choose who can reach you."><Select field="whoCanMessageMe" label="Who can message me"/><Select field="allowEventInvitesFrom" label="Who can invite me to events" allowed={choices.filter(x=>x[0]!=='Followers')}/><Select field="allowGroupChatInvitesFrom" label="Who can add me to group chats" allowed={choices.filter(x=>x[0]!=='Followers')}/></Card>
    <Card icon={Bell} title="Notifications" subtitle="Choose what you want to be notified about.">{[['notifyEventInvites','Event invites'],['notifyNewFollowers','New followers'],['notifyQuickMatches','Quick Match matches'],['notifyChatMessages','Chat messages'],['notifyGroupMessages','Group chat messages'],['notifyEventDiscussionReplies','Event discussion replies'],['notifyNewEventNearby','New event nearby'],['notifyEventStartingSoon','Event starting soon'],['notifyNewMatchNearby','New match nearby']].map(([f,l])=><Toggle key={f} field={f} label={l}/>)}</Card>
    <Card icon={ShieldCheck} title="Safety" subtitle="Manage blocked users, hidden profiles and reports."><div className="settings-row"><strong>Blocked users</strong><button className="settings-manage" onClick={()=>loadSafety('blocked-users')}>{safety?.type==='blocked-users'?'Close':'Manage'}</button></div><div className="settings-row"><strong>Hidden profiles</strong><button className="settings-manage" onClick={()=>loadSafety('hidden-profiles')}>{safety?.type==='hidden-profiles'?'Close':'Manage'}</button></div><div className="settings-row is-disabled"><strong>Report history</strong><span className="settings-soon">Coming soon</span></div>{safety&&<div className="settings-safety-list"><h3>{safety.type==='blocked-users'?'Blocked users':'Hidden profiles'}</h3>{safety.items.length===0?<p>No {safety.type==='blocked-users'?'blocked users':'hidden profiles'}.</p>:safety.items.map(x=><div key={x.userId}><UserAvatar profilePicture={x.profilePicture} initials={x.username.slice(0,2).toUpperCase()} className="settings-safety-avatar"/><span>{x.username}</span><button onClick={()=>removeSafety(x.userId)}>{safety.type==='blocked-users'?'Unblock':'Unhide'}</button></div>)}</div>}</Card>
  </div></div>;
}
export default Settings;
