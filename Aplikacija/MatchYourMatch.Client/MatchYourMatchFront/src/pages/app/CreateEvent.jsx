import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import './CreateEvent.css';
import { useTranslation } from '../../hooks/useTranslation';
import LocationAutocomplete from '../../components/LocationAutocomplete';

const CATEGORIES = ['Study', 'Gaming', 'Coffee', 'Social', 'Sport'];
const initialForm = { title:'', date:'', time:'', location:'', maxAttendees:10, minAge:'', maxAge:'', description:'', showFullAddress:false, requiresParticipantApproval:false };

function CreateEvent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const { t } = useTranslation();
  const [category, setCategory] = useState('Study');
  const [form, setForm] = useState(initialForm);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [ageError, setAgeError] = useState('');

  useEffect(() => {
    if (!editing) return undefined;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/Events/${id}/edit`, { headers:{Authorization:`Bearer ${localStorage.getItem('token')}`}, signal:controller.signal });
        if (!response.ok) throw new Error(await response.text() || t('events.editLoadError'));
        const data = await response.json();
        setCategory(data.category || 'Study');
        setForm({ title:data.title || '', date:data.date || '', time:(data.time || '').slice(0,5), location:data.location || '',
          maxAttendees:data.maxAttendees || 10, minAge:data.minAge ?? '', maxAge:data.maxAge ?? '', description:data.description || '',
          showFullAddress:Boolean(data.showFullAddress), requiresParticipantApproval:Boolean(data.requiresParticipantApproval) });
      } catch (requestError) { if (requestError.name !== 'AbortError') setError(requestError.message); }
      finally { setLoading(false); }
    };
    load();
    return () => controller.abort();
  }, [editing, id, t]);

  const change = event => { setForm(current => ({...current, [event.target.name]:event.target.value})); if (event.target.name === 'minAge' || event.target.name === 'maxAge') setAgeError(''); };
  const validateAgeRange = () => {
    const minAge = form.minAge === '' ? null : Number(form.minAge);
    const maxAge = form.maxAge === '' ? null : Number(form.maxAge);
    if ((minAge != null && (minAge < 13 || minAge > 100)) || (maxAge != null && (maxAge < 13 || maxAge > 100))) return t('events.ageRangeInvalid');
    if (minAge != null && maxAge != null && minAge > maxAge) return t('events.ageRangeInvalid');
    return '';
  };
  const handlePublish = async (event) => {
    event.preventDefault();
    const ageValidation = validateAgeRange();
    if (ageValidation) { setAgeError(ageValidation); return; }
    setError(''); setAgeError(''); setSubmitting(true);
    try {
      const minAge = form.minAge === '' ? null : Number(form.minAge);
      const maxAge = form.maxAge === '' ? null : Number(form.maxAge);
      const payload = {...form, category, minAge, maxAge, description:form.description.trim() || null, maxAttendees:Number(form.maxAttendees || 10), imageUrl:null};
      const response = await fetch(editing ? `/api/Events/${id}` : '/api/Events', {
        method: editing ? 'PUT' : 'POST',
        headers: {'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('token')}`},
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text() || t(editing?'events.updateError':'events.createError'));
      setSuccess(true);
    } catch (requestError) { setError(requestError.message || t(editing?'events.updateError':'events.createError')); }
    finally { setSubmitting(false); }
  };

  if (success) return <div className="page-fade-in create-event"><div className="create-event__card create-event__card--success">
    <CheckCircle size={56} className="create-event__check"/><h2>{t(editing?'events.updated':'events.created')}</h2>
    <p>{t(editing?'events.updatedText':'events.live')}</p><Link to="/app/events" className="app-btn-pill">{t('events.viewEvents').toUpperCase()}</Link>
  </div></div>;

  return <div className="page-fade-in create-event"><form className="create-event__card" onSubmit={handlePublish}>
    <header className="create-event__header"><h1>{t(editing?'events.editTitle':'events.createTitle').toUpperCase()}</h1><p>{t('events.createSubtitle')}</p></header>
    {error && <div className="create-event__error">{error}</div>}
    {loading ? <p className="create-event__loading">{t('common.loading')}</p> : <>
      <label className="create-event__field"><span>{t('events.eventTitle')}</span><input name="title" value={form.title} onChange={change} required placeholder={t('events.titlePlaceholder')}/></label>
      <fieldset className="create-event__field"><span>{t('events.category')}</span><div className="create-event__pills">{CATEGORIES.map(cat => <button key={cat} type="button" className={`create-event__pill${category===cat?' create-event__pill--active':''}`} onClick={()=>setCategory(cat)}>{t(`events.${cat.toLowerCase()}`)}</button>)}</div></fieldset>
      <div className="create-event__row">
        <label className="create-event__field"><span>{t('events.date')}</span><input type="date" name="date" value={form.date} onChange={change} required/></label>
        <label className="create-event__field"><span>{t('events.time')}</span><input type="time" name="time" value={form.time} onChange={change} required/></label>
      </div>
      <LocationAutocomplete value={form.location} onChange={location=>setForm(current=>({...current,location}))}
        label={t('events.location')} placeholder={t('events.locationPlaceholder')} loadingText={t('profileSettings.findingPlaces')}/>
      <fieldset className="create-event__visibility"><legend>{t('events.locationVisibility')}</legend>
        <label><input type="radio" name="locationVisibility" checked={form.showFullAddress} onChange={()=>setForm(current=>({...current,showFullAddress:true}))}/><span>{t('events.showFullAddress')}</span></label>
        <label className="create-event__recommended"><input type="radio" name="locationVisibility" checked={!form.showFullAddress} onChange={()=>setForm(current=>({...current,showFullAddress:false}))}/><span>{t('events.showCityCountry')}<small>{t('events.recommended')}</small></span></label>
      </fieldset>
      <label className="create-event__field"><span>{t('events.maxAttendees')}</span><input type="number" name="maxAttendees" min="2" value={form.maxAttendees} onChange={change}/></label>
      <div className="create-event__row create-event__age-row">
        <label className="create-event__field"><span>{t('events.minimumAgeOptional')}</span><input type="number" name="minAge" min="13" max="100" value={form.minAge} onChange={change}/></label>
        <label className="create-event__field"><span>{t('events.maximumAgeOptional')}</span><input type="number" name="maxAge" min="13" max="100" value={form.maxAge} onChange={change}/></label>
      </div>
      {ageError && <p className="create-event__field-error">{ageError}</p>}
      <label className="create-event__approval">
        <span><strong>{t('events.requireApproval')}</strong><small>{t('events.requireApprovalHelp')}</small></span>
        <input type="checkbox" checked={form.requiresParticipantApproval}
          onChange={event=>setForm(current=>({...current,requiresParticipantApproval:event.target.checked}))}/>
        <i aria-hidden="true"/>
      </label>
      <label className="create-event__field"><span>{t('events.description')}</span><textarea name="description" rows={4} value={form.description} onChange={change} placeholder={t('events.descriptionPlaceholder')}/></label>
      <div className="create-event__actions"><button type="button" className="create-event__cancel" onClick={()=>navigate('/app/events')}>{t('common.cancel')}</button><button type="submit" className="app-btn-pill" disabled={submitting}>{submitting?t('events.publishing').toUpperCase():t(editing?'common.save':'events.publish').toUpperCase()}</button></div>
    </>}
  </form></div>;
}

export default CreateEvent;
