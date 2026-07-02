import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import "./CreateEvent.css";
import { useTranslation } from "../../hooks/useTranslation";
import LocationAutocomplete from "../../components/LocationAutocomplete";
import { isOrganizerSession } from "../../services/guestSession";

const CATEGORIES = ["Study", "Gaming", "Coffee", "Social", "Sport"];
const EVENT_START_IN_PAST_CODE = "EVENT_START_IN_PAST";
const EVENT_START_IN_PAST_MESSAGE = "Event start time must be in the future.";

const initialForm = {
  title: "",
  date: "",
  time: "",
  location: "",
  maxAttendees: 10,
  minAge: "",
  maxAge: "",
  description: "",
  showFullAddress: false,
  requiresParticipantApproval: false,
};

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateAndTime(date, time) {
  if (!date || !time) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((value) => Number.isNaN(value)))
    return null;

  return new Date(year, month - 1, day, hours, minutes);
}

function getEventStartValidationMessage(date, time, now) {
  const eventStart = combineDateAndTime(date, time);
  if (!eventStart) return "";

  return eventStart > now ? "" : EVENT_START_IN_PAST_MESSAGE;
}

function getMinimumTimeForDate(date, now) {
  const today = toDateInputValue(now);
  if (date !== today) return undefined;

  const nextMinute = new Date(now.getTime() + 60000);
  return toDateInputValue(nextMinute) === today
    ? toTimeInputValue(nextMinute)
    : "23:59";
}

async function readEventError(response) {
  const rawError = await response.text();
  if (!rawError) return "";

  try {
    const parsed = JSON.parse(rawError);
    if (parsed.errorCode === EVENT_START_IN_PAST_CODE)
      return EVENT_START_IN_PAST_MESSAGE;
    return parsed.message || rawError;
  } catch {
    return rawError;
  }
}

function CreateEvent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const organizerReturnPath = isOrganizerSession() ? "/app/organizer" : "/app/events";
  const { t } = useTranslation();
  const [category, setCategory] = useState("Study");
  const [form, setForm] = useState(initialForm);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [ageError, setAgeError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const today = toDateInputValue(now);
  const minTimeForSelectedDate = getMinimumTimeForDate(form.date, now);
  const eventStartError = getEventStartValidationMessage(form.date, form.time, now);

  useEffect(() => {
    if (!editing) return undefined;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/Events/${id}/edit`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error((await response.text()) || t("events.editLoadError"));
        const data = await response.json();
        setCategory(data.category || "Study");
        setForm({
          title: data.title || "",
          date: data.date || "",
          time: (data.time || "").slice(0, 5),
          location: data.location || "",
          maxAttendees: data.maxAttendees || 10,
          minAge: data.minAge ?? "",
          maxAge: data.maxAge ?? "",
          description: data.description || "",
          showFullAddress: Boolean(data.showFullAddress),
          requiresParticipantApproval: Boolean(
            data.requiresParticipantApproval,
          ),
        });
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [editing, id, t]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const change = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    if (event.target.name === "minAge" || event.target.name === "maxAge")
      setAgeError("");
  };
  const validateAgeRange = () => {
    const minAge = form.minAge === "" ? null : Number(form.minAge);
    const maxAge = form.maxAge === "" ? null : Number(form.maxAge);
    if (
      (minAge != null && (minAge < 13 || minAge > 100)) ||
      (maxAge != null && (maxAge < 13 || maxAge > 100))
    )
      return t("events.ageRangeInvalid");
    if (minAge != null && maxAge != null && minAge > maxAge)
      return t("events.ageRangeInvalid");
    return "";
  };
  const handlePublish = async (event) => {
    event.preventDefault();
    const ageValidation = validateAgeRange();
    if (ageValidation) {
      setAgeError(ageValidation);
      return;
    }
    if (eventStartError) return;
    setError("");
    setAgeError("");
    setSubmitting(true);
    try {
      const minAge = form.minAge === "" ? null : Number(form.minAge);
      const maxAge = form.maxAge === "" ? null : Number(form.maxAge);
      const payload = {
        ...form,
        category,
        minAge,
        maxAge,
        description: form.description.trim() || null,
        maxAttendees: Number(form.maxAttendees || 10),
        imageUrl: null,
      };
      const response = await fetch(
        editing ? `/api/Events/${id}` : "/api/Events",
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok)
        throw new Error(
          (await readEventError(response)) ||
            t(editing ? "events.updateError" : "events.createError"),
        );
      setSuccess(true);
    } catch (requestError) {
      setError(
        requestError.message ||
          t(editing ? "events.updateError" : "events.createError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success)
    return (
      <div className="page-fade-in create-event">
        <div className="create-event__card create-event__card--success">
          <CheckCircle size={56} className="create-event__check" />
          <h2>{t(editing ? "events.updated" : "events.created")}</h2>
          <p>{t(editing ? "events.updatedText" : "events.live")}</p>
          <Link to={organizerReturnPath} className="app-btn-pill">
            {t("events.viewEvents").toUpperCase()}
          </Link>
        </div>
      </div>
    );

  return (
    <div className="page-fade-in create-event">
      <form className="create-event__card" onSubmit={handlePublish}>
        <header className="create-event__header">
          <h1>
            {t(
              editing ? "events.editTitle" : "events.createTitle",
            ).toUpperCase()}
          </h1>
          <p>{t("events.createSubtitle")}</p>
        </header>
        {error && <div className="create-event__error">{error}</div>}
        {eventStartError && (
          <div className="create-event__error">{eventStartError}</div>
        )}
        {loading ? (
          <p className="create-event__loading">{t("common.loading")}</p>
        ) : (
          <>
            <label className="create-event__field">
              <span>{t("events.eventTitle")}</span>
              <input
                name="title"
                value={form.title}
                onChange={change}
                required
                placeholder={t("events.titlePlaceholder")}
              />
            </label>
            <fieldset className="create-event__field">
              <span>{t("events.category")}</span>
              <div className="create-event__pills">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`create-event__pill${category === cat ? " create-event__pill--active" : ""}`}
                    onClick={() => setCategory(cat)}
                  >
                    {t(`events.${cat.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="create-event__row">
              <label className="create-event__field">
                <span>{t("events.date")}</span>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={change}
                  min={today}
                  required
                />
              </label>
              <label className="create-event__field">
                <span>{t("events.time")}</span>
                <input
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={change}
                  min={minTimeForSelectedDate}
                  required
                />
              </label>
            </div>
            <LocationAutocomplete
              value={form.location}
              onChange={(location) =>
                setForm((current) => ({ ...current, location }))
              }
              label={t("events.location")}
              placeholder={t("events.locationPlaceholder")}
              loadingText={t("profileSettings.findingPlaces")}
            />
            <fieldset className="create-event__visibility">
              <legend>{t("events.locationVisibility")}</legend>
              <label>
                <input
                  type="radio"
                  name="locationVisibility"
                  checked={form.showFullAddress}
                  onChange={() =>
                    setForm((current) => ({
                      ...current,
                      showFullAddress: true,
                    }))
                  }
                />
                <span>{t("events.showFullAddress")}</span>
              </label>
              <label className="create-event__recommended">
                <input
                  type="radio"
                  name="locationVisibility"
                  checked={!form.showFullAddress}
                  onChange={() =>
                    setForm((current) => ({
                      ...current,
                      showFullAddress: false,
                    }))
                  }
                />
                <span>
                  {t("events.showCityCountry")}
                  <small>{t("events.recommended")}</small>
                </span>
              </label>
            </fieldset>
            <label className="create-event__field">
              <span>{t("events.maxAttendees")}</span>
              <input
                type="number"
                name="maxAttendees"
                min="2"
                value={form.maxAttendees}
                onChange={change}
              />
            </label>
            <div className="create-event__row create-event__age-row">
              <label className="create-event__field">
                <span>{t("events.minimumAgeOptional")}</span>
                <input
                  type="number"
                  name="minAge"
                  min="13"
                  max="100"
                  value={form.minAge}
                  onChange={change}
                />
              </label>
              <label className="create-event__field">
                <span>{t("events.maximumAgeOptional")}</span>
                <input
                  type="number"
                  name="maxAge"
                  min="13"
                  max="100"
                  value={form.maxAge}
                  onChange={change}
                />
              </label>
            </div>
            {ageError && (
              <p className="create-event__field-error">{ageError}</p>
            )}
            <label className="create-event__approval">
              <span>
                <strong>{t("events.requireApproval")}</strong>
                <small>{t("events.requireApprovalHelp")}</small>
              </span>
              <input
                type="checkbox"
                checked={form.requiresParticipantApproval}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    requiresParticipantApproval: event.target.checked,
                  }))
                }
              />
              <i aria-hidden="true" />
            </label>
            <label className="create-event__field">
              <span>{t("events.description")}</span>
              <textarea
                name="description"
                rows={4}
                value={form.description}
                onChange={change}
                placeholder={t("events.descriptionPlaceholder")}
              />
            </label>
            <div className="create-event__actions">
              <button
                type="button"
                className="create-event__cancel"
                onClick={() => navigate(organizerReturnPath)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="app-btn-pill"
                disabled={submitting || Boolean(eventStartError)}
              >
                {submitting
                  ? t("events.publishing").toUpperCase()
                  : t(editing ? "common.save" : "events.publish").toUpperCase()}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default CreateEvent;
