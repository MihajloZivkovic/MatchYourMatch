import { useEffect, useRef, useState } from "react";
import { Plus, SmilePlus } from "lucide-react";
import {
  EXTRA_REACTION_EMOJI,
  getReactionPreset,
  saveReactionPreset,
} from "../../utils/chatReactions";
import "./MessageReactions.css";

function MessageReactions({ message, currentUserId, onReact, align = "start", compact = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [preset, setPreset] = useState(() => getReactionPreset(currentUserId));
  const rootRef = useRef(null);
  const reactions = Array.isArray(message?.reactions) ? message.reactions : [];
  const hasReactions = reactions.length > 0;

  useEffect(() => {
    setPreset(getReactionPreset(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    if (!pickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setPickerOpen(false);
        setCustomizing(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPickerOpen(false);
        setCustomizing(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  if (!message || message.isDeletedForEveryone) {
    return null;
  }

  const handleReact = async (emoji) => {
    await onReact(message, emoji);
    setPickerOpen(false);
    setCustomizing(false);
  };

  const handleReplacePreset = (emoji) => {
    setPreset((current) => {
      if (current.includes(emoji) && current[selectedSlot] !== emoji) {
        return current;
      }

      const next = [...current];
      next[selectedSlot] = emoji;
      return saveReactionPreset(currentUserId, next);
    });
  };

  return (
    <div
      ref={rootRef}
      className={`message-reactions message-reactions--${align}${
        compact ? " message-reactions--compact" : ""
      }`}
    >
      {hasReactions && (
        <div className="message-reactions__chips" aria-label="Message reactions">
          {reactions.map((reaction) => (
            <button
              type="button"
              key={reaction.emoji}
              className={`message-reactions__chip${
                reaction.reactedByCurrentUser ? " message-reactions__chip--mine" : ""
              }`}
              onClick={() => handleReact(reaction.emoji)}
              aria-label={`React with ${reaction.emoji}`}
            >
              <span>{reaction.emoji}</span>
              <b>{reaction.count}</b>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="message-reactions__trigger"
        aria-label="Add reaction"
        aria-expanded={pickerOpen}
        onClick={() => {
          setPickerOpen((open) => !open);
          setCustomizing(false);
        }}
      >
        <SmilePlus size={compact ? 13 : 15} />
      </button>

      {pickerOpen && (
        <div className="message-reactions__picker" role="dialog" aria-label="Choose reaction">
          <div className="message-reactions__row">
            {preset.map((emoji) => (
              <button
                type="button"
                key={emoji}
                className={message.currentUserReaction === emoji ? "is-selected" : ""}
                onClick={() => handleReact(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              className="message-reactions__plus"
              aria-label="Customize reactions"
              onClick={() => setCustomizing((value) => !value)}
            >
              <Plus size={compact ? 14 : 16} />
            </button>
          </div>

          {customizing && (
            <div className="message-reactions__custom">
              <div className="message-reactions__slots" aria-label="Preset reaction slots">
                {preset.map((emoji, index) => (
                  <button
                    type="button"
                    key={`${emoji}-${index}`}
                    className={selectedSlot === index ? "is-active" : ""}
                    onClick={() => setSelectedSlot(index)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="message-reactions__extras" aria-label="Extra reactions">
                {EXTRA_REACTION_EMOJI.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    disabled={preset.includes(emoji) && preset[selectedSlot] !== emoji}
                    onClick={() => handleReplacePreset(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageReactions;
