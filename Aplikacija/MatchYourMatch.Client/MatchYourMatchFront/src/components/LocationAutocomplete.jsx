import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { locationService } from '../services/locationService';
import './LocationAutocomplete.css';

export default function LocationAutocomplete({ value, onChange, placeholder, label, loadingText }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!active || query.length < 3) {
      return undefined;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try { setSuggestions(await locationService.search(query, controller.signal)); }
      catch (error) { if (error.name !== 'AbortError') setSuggestions([]); }
      finally { setLoading(false); }
    }, 350);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [active, value]);

  return <label className="location-autocomplete">
    {label && <span>{label}</span>}
    <div className="location-autocomplete__control"><MapPin size={16}/><input type="text" value={value} required
      placeholder={placeholder} autoComplete="street-address"
      onChange={event => { onChange(event.target.value); setActive(true); if (event.target.value.trim().length < 3) setSuggestions([]); }}
      onFocus={() => setActive(true)} /></div>
    {(loading || suggestions.length > 0) && <div className="location-autocomplete__suggestions">
      {loading && <span>{loadingText}</span>}
      {!loading && suggestions.map(suggestion => <button key={suggestion.locationInput} type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={() => { onChange(suggestion.locationInput || suggestion.displayName); setSuggestions([]); setActive(false); }}>
        <strong>{suggestion.displayName}</strong><small>{suggestion.locationInput}</small>
      </button>)}
    </div>}
  </label>;
}
