import { useEffect, useState } from 'react';

const preferenceFields = [
  {
    name: 'relationshipValue',
    label: 'Relationship value',
    options: ['Trust & honesty', 'Adventure & spontaneity', 'Deep conversations', 'Shared goals'],
  },
  {
    name: 'communicationStyle',
    label: 'Communication style',
    options: ['Direct and honest', 'Thoughtful and calm', 'Playful and light', 'Deep and reflective'],
  },
  {
    name: 'freeTimePreference',
    label: 'Ideal free time',
    options: ['Quiet night in', 'Social outing', 'Creative hobby', 'Outdoor activity'],
  },
  {
    name: 'socialEnergy',
    label: 'Social energy',
    options: ['Introverted', 'Balanced', 'Extroverted', 'Depends on the day'],
  },
  {
    name: 'relationshipPace',
    label: 'Relationship pace',
    options: ['Slow and intentional', 'Natural and flexible', 'Clear and committed', 'Adventurous and spontaneous'],
  },
];

const emptyPreferences = {
  relationshipValue: '',
  communicationStyle: '',
  freeTimePreference: '',
  socialEnergy: '',
  relationshipPace: '',
  importantValues: '',
  lifestylePreferences: '',
  isComplete: false,
};

function DeepPreferencesSection() {
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [draft, setDraft] = useState(emptyPreferences);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/UserProfile/me/deep-preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Deep Match preferences could not be loaded.');
        }

        const data = await response.json();
        setPreferences({ ...emptyPreferences, ...data });
        setDraft({ ...emptyPreferences, ...data });
      } catch (err) {
        setError(err.message || 'Deep Match preferences could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const startEditing = () => {
    setDraft(preferences);
    setEditing(true);
    setError('');
  };

  const cancelEditing = () => {
    setDraft(preferences);
    setEditing(false);
    setError('');
  };

  const savePreferences = async () => {
    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/UserProfile/me/deep-preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || 'Deep Match preferences could not be saved.');
      }

      const data = await response.json();
      setPreferences({ ...emptyPreferences, ...data });
      setDraft({ ...emptyPreferences, ...data });
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Deep Match preferences could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="profile__block profile__deep-card">
        <h3>Deep Match Preferences</h3>
        <p className="profile__section-note">Loading preferences...</p>
      </section>
    );
  }

  return (
    <section className="profile__block profile__deep-card">
      <div className="profile__section-head">
        <div>
          <h3>Deep Match Preferences</h3>
          <p className="profile__section-note">Long-term answers used to sort your best matches.</p>
        </div>
        {!editing && (
          <button type="button" className="app-btn-pill app-btn-pill--outline" onClick={startEditing}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="profile__preference-form">
          {preferenceFields.map((field) => (
            <label key={field.name} className="profile__pref-field">
              <span>{field.label}</span>
              <select name={field.name} value={draft[field.name] || ''} onChange={handleChange}>
                <option value="">Choose option</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label className="profile__pref-field profile__pref-field--wide">
            <span>Important values</span>
            <input
              name="importantValues"
              value={draft.importantValues || ''}
              onChange={handleChange}
              placeholder="Kindness, ambition, humor..."
            />
          </label>

          <label className="profile__pref-field profile__pref-field--wide">
            <span>Lifestyle preferences</span>
            <input
              name="lifestylePreferences"
              value={draft.lifestylePreferences || ''}
              onChange={handleChange}
              placeholder="Night owl, active weekends..."
            />
          </label>

          {error && <p className="profile__form-error">{error}</p>}

          <div className="profile__edit-actions">
            <button type="button" className="app-btn-pill" onClick={savePreferences} disabled={saving}>
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
            <button type="button" className="profile__quiet-btn" onClick={cancelEditing}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="profile__pref-grid">
            {preferenceFields.map((field) => (
              <div key={field.name} className="profile__pref-tile">
                <span>{field.label}</span>
                <strong>{preferences[field.name] || 'Not set'}</strong>
              </div>
            ))}
          </div>
          <div className="profile__pills profile__pref-pills">
            {(preferences.importantValues || 'Important values not set')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => (
                <span key={item} className="profile__pill">
                  {item}
                </span>
              ))}
            {preferences.lifestylePreferences && (
              <span className="profile__pill">{preferences.lifestylePreferences}</span>
            )}
          </div>
          {error && <p className="profile__form-error">{error}</p>}
        </>
      )}
    </section>
  );
}

export default DeepPreferencesSection;
