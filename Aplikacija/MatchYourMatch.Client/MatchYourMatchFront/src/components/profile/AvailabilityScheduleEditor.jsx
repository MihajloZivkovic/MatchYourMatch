import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

const days = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const defaultDraftByDay = days.reduce((acc, day) => {
  acc[day.value] = { startTime: '18:00', endTime: '20:00' };
  return acc;
}, {});

const formatTime = (value) => (value ? value.slice(0, 5) : '');
const OVERLAPPING_TIME_SLOTS_MESSAGE =
  'Time slots for the same day cannot overlap.';
const INVALID_TIME_ORDER_MESSAGE = 'Start time must be before end time.';

const normalizeSlots = (slots) =>
  slots
    .map((slot) => ({
      ...slot,
      dayOfWeek: Number(slot.dayOfWeek),
      startTime: formatTime(slot.startTime),
      endTime: formatTime(slot.endTime),
    }))
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
    );

const timeToMinutes = (time) => {
  if (!time) return null;

  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

  return hours * 60 + minutes;
};

const doSlotsOverlap = (existingSlot, newSlot) => {
  const existingStart = timeToMinutes(existingSlot.startTime);
  const existingEnd = timeToMinutes(existingSlot.endTime);
  const newStart = timeToMinutes(newSlot.startTime);
  const newEnd = timeToMinutes(newSlot.endTime);

  if (
    existingStart === null ||
    existingEnd === null ||
    newStart === null ||
    newEnd === null
  ) {
    return false;
  }

  return existingStart < newEnd && newStart < existingEnd;
};

const hasOverlappingSlots = (slots) =>
  slots.some((slot, index) =>
    slots
      .slice(index + 1)
      .some(
        (otherSlot) =>
          Number(otherSlot.dayOfWeek) === Number(slot.dayOfWeek) &&
          doSlotsOverlap(slot, otherSlot),
      ),
  );

const findInvalidDayMessage = (slots) => {
  for (const day of days) {
    const daySlots = slots.filter(
      (slot) => Number(slot.dayOfWeek) === day.value,
    );
    const hasInvalidTime = daySlots.some((slot) => {
      const start = timeToMinutes(slot.startTime);
      const end = timeToMinutes(slot.endTime);

      return start === null || end === null || start >= end;
    });

    if (hasInvalidTime) {
      return { dayOfWeek: day.value, message: INVALID_TIME_ORDER_MESSAGE };
    }

    if (hasOverlappingSlots(daySlots)) {
      return {
        dayOfWeek: day.value,
        message: OVERLAPPING_TIME_SLOTS_MESSAGE,
      };
    }
  }

  return null;
};

const getSaveErrorMessage = async (response) => {
  const fallback = 'Free time schedule could not be saved.';
  const rawBody = await response.text();

  if (!rawBody) return fallback;

  try {
    const body = JSON.parse(rawBody);
    return body?.message || fallback;
  } catch {
    return rawBody;
  }
};

function AvailabilityScheduleEditor() {
  const { t } = useTranslation();
  const [slots, setSlots] = useState([]);
  const [draftSlots, setDraftSlots] = useState([]);
  const [dayDrafts, setDayDrafts] = useState(defaultDraftByDay);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dayErrors, setDayErrors] = useState({});

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/UserProfile/me/availability', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Free time schedule could not be loaded.');
        }

        const normalized = normalizeSlots(await response.json());
        setSlots(normalized);
        setDraftSlots(normalized);
      } catch (err) {
        setError(err.message || 'Free time schedule could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, []);

  const slotsByDay = useMemo(
    () =>
      days.reduce((acc, day) => {
        acc[day.value] = draftSlots.filter(
          (slot) => Number(slot.dayOfWeek) === day.value,
        );
        return acc;
      }, {}),
    [draftSlots],
  );

  const savedSlotsByDay = useMemo(
    () =>
      days.reduce((acc, day) => {
        acc[day.value] = slots.filter(
          (slot) => Number(slot.dayOfWeek) === day.value,
        );
        return acc;
      }, {}),
    [slots],
  );

  const startEditing = () => {
    setDraftSlots(slots);
    setDayDrafts(defaultDraftByDay);
    setEditing(true);
    setError('');
    setDayErrors({});
  };

  const cancelEditing = () => {
    setDraftSlots(slots);
    setDayDrafts(defaultDraftByDay);
    setEditing(false);
    setError('');
    setDayErrors({});
  };

  const updateDayDraft = (dayOfWeek, field, value) => {
    setDayDrafts((current) => ({
      ...current,
      [dayOfWeek]: {
        ...current[dayOfWeek],
        [field]: value,
      },
    }));
    setError('');
    setDayErrors((current) => ({ ...current, [dayOfWeek]: '' }));
  };

  const addSlotForDay = (dayOfWeek) => {
    const draft = dayDrafts[dayOfWeek];

    if (!draft?.startTime || !draft?.endTime) {
      setDayErrors((current) => ({
        ...current,
        [dayOfWeek]: 'Choose both start and end time before adding availability.',
      }));
      return;
    }

    const newSlot = {
      dayOfWeek,
      startTime: draft.startTime,
      endTime: draft.endTime,
    };
    const start = timeToMinutes(newSlot.startTime);
    const end = timeToMinutes(newSlot.endTime);

    if (start === null || end === null || start >= end) {
      setDayErrors((current) => ({
        ...current,
        [dayOfWeek]: INVALID_TIME_ORDER_MESSAGE,
      }));
      return;
    }

    if (
      draftSlots
        .filter((slot) => Number(slot.dayOfWeek) === dayOfWeek)
        .some((slot) => doSlotsOverlap(slot, newSlot))
    ) {
      setDayErrors((current) => ({
        ...current,
        [dayOfWeek]: OVERLAPPING_TIME_SLOTS_MESSAGE,
      }));
      return;
    }

    setDraftSlots((current) =>
      normalizeSlots([...current, newSlot]),
    );
    setError('');
    setDayErrors((current) => ({ ...current, [dayOfWeek]: '' }));
  };

  const removeSlot = (dayOfWeek, slotIndex) => {
    setDraftSlots((current) => {
      let seenInDay = -1;

      return current.filter((slot) => {
        if (Number(slot.dayOfWeek) !== dayOfWeek) return true;
        seenInDay += 1;
        return seenInDay !== slotIndex;
      });
    });
    setDayErrors((current) => ({ ...current, [dayOfWeek]: '' }));
  };

  const saveSlots = async () => {
    const validationError = findInvalidDayMessage(draftSlots);
    if (validationError) {
      setDayErrors((current) => ({
        ...current,
        [validationError.dayOfWeek]: validationError.message,
      }));
      setError(validationError.message);
      return;
    }

    setSaving(true);
    setError('');
    setDayErrors({});

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/UserProfile/me/availability', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slots: draftSlots.map((slot) => ({
            dayOfWeek: Number(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(await getSaveErrorMessage(response));
      }

      const normalized = normalizeSlots(await response.json());
      setSlots(normalized);
      setDraftSlots(normalized);
      setEditing(false);
      setDayErrors({});
    } catch (err) {
      setError(err.message || 'Free time schedule could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className='profile__block profile__deep-card'>
        <h3>{t('profile.schedule')}</h3>
        <p className='profile__section-note'>
          {t('profile.loadingAvailability')}
        </p>
      </section>
    );
  }

  return (
    <section className='profile__block profile__deep-card'>
      <div className='profile__section-head'>
        <div>
          <h3>{t('profile.schedule')}</h3>
          <p className='profile__section-note'>{t('profile.scheduleNote')}</p>
        </div>
        {!editing && (
          <button
            type='button'
            className='app-btn-pill app-btn-pill--outline'
            onClick={startEditing}
          >
            {t('profileFields.edit')}
          </button>
        )}
      </div>

      <div className='profile__week-planner'>
        {days.map((day) => {
          const daySlots = editing
            ? slotsByDay[day.value]
            : savedSlotsByDay[day.value];
          const draft = dayDrafts[day.value];

          return (
            <article key={day.value} className='profile__day-card'>
              <div className='profile__day-head'>
                <h4>{t(`profileFields.${day.label}`)}</h4>
                <span>
                  {t('profileUi.slotsSet', { count: daySlots.length })}
                </span>
              </div>

              <div className='profile__day-slots'>
                {daySlots.length === 0 ? (
                  <span className='profile__day-empty'>
                    {t('profile.noAvailability')}
                  </span>
                ) : (
                  daySlots.map((slot, index) => (
                    <span
                      key={`${day.value}-${slot.startTime}-${slot.endTime}-${index}`}
                      className='profile__time-pill'
                    >
                      {slot.startTime} - {slot.endTime}
                      {editing && (
                        <button
                          type='button'
                          aria-label={t('profileUi.removeSlot', {
                            day: t(`profileFields.${day.label}`),
                            start: slot.startTime,
                            end: slot.endTime,
                          })}
                          onClick={() => removeSlot(day.value, index)}
                        >
                          x
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {editing && (
                <>
                  <div className='profile__day-add'>
                    <input
                      type='time'
                      value={draft.startTime}
                      onChange={(event) =>
                        updateDayDraft(
                          day.value,
                          'startTime',
                          event.target.value,
                        )
                      }
                    />
                    <input
                      type='time'
                      value={draft.endTime}
                      onChange={(event) =>
                        updateDayDraft(day.value, 'endTime', event.target.value)
                      }
                    />
                    <button
                      type='button'
                      onClick={() => addSlotForDay(day.value)}
                    >
                      +
                    </button>
                  </div>
                  {dayErrors[day.value] && (
                    <p className='profile__form-error'>
                      {dayErrors[day.value]}
                    </p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className='profile__form-error'>{error}</p>}

      {editing && (
        <div className='profile__edit-actions'>
          <button
            type='button'
            className='app-btn-pill'
            onClick={saveSlots}
            disabled={saving}
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
          <button
            type='button'
            className='profile__quiet-btn'
            onClick={cancelEditing}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </section>
  );
}

export default AvailabilityScheduleEditor;
