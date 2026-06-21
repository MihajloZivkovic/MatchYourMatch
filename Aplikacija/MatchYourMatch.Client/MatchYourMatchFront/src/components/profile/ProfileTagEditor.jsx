import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

function ProfileTagEditor({ title, tags = [], maxTags, placeholder, emptyText, suggestions = [], onSave, compact = false, externalEditing = false, onChange, formatTag = tag => tag }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const controlled = typeof onChange === "function";
  const isEditing = controlled ? externalEditing : editing;
  const workingTags = controlled ? tags : draft;
  const updateTags = updater => {
    if (controlled) onChange(typeof updater === "function" ? updater(tags) : updater);
    else setDraft(updater);
  };

  useEffect(() => { if (!editing) setDraft(tags); }, [editing, tags]);

  const addTag = value => {
    const tag = value.trim();
    if (!tag) return;
    if (tag.length > 60) { setError(t("profileTags.tooLong")); return; }
    if (workingTags.some(item => item.toLowerCase() === tag.toLowerCase())) { setError(t("profileTags.duplicate")); return; }
    if (workingTags.length >= maxTags) { setError(t("profileTags.tooMany", { count: maxTags })); return; }
    updateTags(current => [...current, tag]);
    setInput("");
    setError("");
  };

  const cancel = () => {
    setDraft(tags);
    setInput("");
    setError("");
    setShowAllSuggestions(false);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true); setError("");
    try { await onSave(draft); setEditing(false); }
    catch (saveError) { setError(saveError.message || t("profileTags.saveError")); }
    finally { setSaving(false); }
  };

  return <div className={`profile-tag-editor${compact ? " profile-tag-editor--compact" : ""}`}>
    <div className="profile-tag-editor__heading">
      <span>{title}</span>
      {!controlled && !editing && <button type="button" onClick={() => setEditing(true)}>{t("profileFields.edit")}</button>}
    </div>

    <div className="profile-tag-editor__chips">
      {(isEditing ? workingTags : tags).map(tag => <span key={tag}>
        {formatTag(tag)}
        {isEditing && <button type="button" aria-label={`${t("common.delete")} ${tag}`}
          onClick={() => updateTags(current => current.filter(item => item !== tag))}><X size={13}/></button>}
      </span>)}
      {!isEditing && tags.length === 0 && <small>{emptyText}</small>}
    </div>

    {isEditing && <div className="profile-tag-editor__edit">
      <div className="profile-tag-editor__input-row">
        <input value={input} maxLength={60} placeholder={placeholder} onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTag(input); } }}/>
        <button type="button" onClick={() => addTag(input)} disabled={!input.trim()}><Plus size={14}/>{t("profileTags.add")}</button>
      </div>
      {suggestions.length > 0 && <div className="profile-tag-editor__suggestion-area">
        <small>{t("profileTags.suggested")}</small>
        <div className="profile-tag-editor__suggestions">
          {suggestions
            .filter(tag => !workingTags.some(item => item.toLowerCase() === tag.toLowerCase()))
            .slice(0, showAllSuggestions ? suggestions.length : 12)
            .map(tag => <button key={tag} type="button" onClick={() => addTag(tag)}>+ {formatTag(tag)}</button>)}
        </div>
        {suggestions.filter(tag => !workingTags.some(item => item.toLowerCase() === tag.toLowerCase())).length > 12 &&
          <button className="profile-tag-editor__show-more" type="button" onClick={() => setShowAllSuggestions(value => !value)}>
            {t(showAllSuggestions ? "profileTags.showLess" : "profileTags.showMore")}
          </button>}
      </div>}
      {error && <p className="profile-tag-editor__error">{error}</p>}
      {!controlled && <div className="profile-tag-editor__actions">
        <button type="button" onClick={cancel} disabled={saving}>{t("common.cancel")}</button>
        <button type="button" className="saveButton" onClick={save} disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button>
      </div>}
    </div>}
  </div>;
}

export default ProfileTagEditor;
