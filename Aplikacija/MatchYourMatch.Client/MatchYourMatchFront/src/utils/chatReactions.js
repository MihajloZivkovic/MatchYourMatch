export const DEFAULT_REACTION_PRESET = ["👍", "❤️", "😂", "😮", "😢"];
export const EXTRA_REACTION_EMOJI = ["🔥", "🎉", "😍", "😭", "😡", "👀", "🙌", "🤝", "💀", "🥲"];

export function getReactionPreset(userId) {
  if (typeof window === "undefined") return DEFAULT_REACTION_PRESET;

  try {
    const stored = window.localStorage.getItem(getReactionStorageKey(userId));
    return normalizeReactionPreset(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_REACTION_PRESET;
  }
}

export function saveReactionPreset(userId, preset) {
  if (typeof window === "undefined") return DEFAULT_REACTION_PRESET;

  const normalized = normalizeReactionPreset(preset);

  try {
    window.localStorage.setItem(getReactionStorageKey(userId), JSON.stringify(normalized));
  } catch {
    return normalized;
  }

  return normalized;
}

export function normalizeReactionPreset(preset) {
  const unique = [];

  if (Array.isArray(preset)) {
    preset.forEach((emoji) => {
      if (typeof emoji === "string" && emoji.trim() && !unique.includes(emoji.trim())) {
        unique.push(emoji.trim());
      }
    });
  }

  DEFAULT_REACTION_PRESET.forEach((emoji) => {
    if (unique.length < 5 && !unique.includes(emoji)) {
      unique.push(emoji);
    }
  });

  return unique.slice(0, 5);
}

function getReactionStorageKey(userId) {
  return userId ? `mym_reaction_preset_${userId}` : "mym_reaction_preset";
}
