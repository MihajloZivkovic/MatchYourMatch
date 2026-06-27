import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import GuestCityModal from './GuestCityModal';

function GuestEntryButton({ className = '', labelKey = 'guest.enter', uppercase = false }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const label = t(labelKey);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        {uppercase ? label.toUpperCase() : label}
      </button>
      {open && <GuestCityModal onClose={() => setOpen(false)} />}
    </>
  );
}

export default GuestEntryButton;
