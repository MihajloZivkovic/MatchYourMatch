import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./ConfirmModal.css";

function ConfirmModal({
  isOpen,
  title,
  message,
  errorMessage = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isLoading) {
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="confirm-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel?.();
        }
      }}
    >
      <section
        className={`confirm-modal__card confirm-modal__card--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <div className="confirm-modal__accent" aria-hidden="true" />
        <div className="confirm-modal__content">
          <h2 id="confirm-modal-title">{title}</h2>
          <p id="confirm-modal-message">{message}</p>
          {errorMessage && <strong className="confirm-modal__error">{errorMessage}</strong>}
        </div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__button confirm-modal__button--cancel"
            disabled={isLoading}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="confirm-modal__button confirm-modal__button--confirm"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? "Working..." : confirmText}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default ConfirmModal;
