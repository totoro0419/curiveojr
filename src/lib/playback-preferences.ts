/**
 * Device-local playback preferences. This is intentionally separate from video progress.
 * YouTube does not offer a documented API that guarantees captions stay disabled,
 * so the OFF preference is best effort while ON uses the official cc_load_policy.
 */
export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export type CaptionLanguage = "ja" | "en";

export interface PlaybackPreferences {
  rate: number;
  captionsEnabled: boolean;
  captionLanguage: CaptionLanguage;
}

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  rate: 1,
  captionsEnabled: false,
  captionLanguage: "ja",
};

const STORAGE_KEY = "curiveo-playback-preferences-v1";

export function readPlaybackPreferences(): PlaybackPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PLAYBACK_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYBACK_PREFERENCES };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_PLAYBACK_PREFERENCES };
    // Backward compatibility: v1 captions = "youtube" | "ja" | "en".
    // Unset/default YouTube preference becomes OFF; explicitly selected languages stay ON.
    const stored = value as Partial<PlaybackPreferences> & { captions?: string };
    const legacyLanguage = stored.captions === "en" ? "en" : "ja";
    const legacyEnabled = stored.captions === "ja" || stored.captions === "en";
    return {
      rate: PLAYBACK_RATES.some((rate) => rate === stored.rate)
        ? (stored.rate as number)
        : DEFAULT_PLAYBACK_PREFERENCES.rate,
      captionsEnabled:
        typeof stored.captionsEnabled === "boolean"
          ? stored.captionsEnabled
          : legacyEnabled,
      captionLanguage:
        stored.captionLanguage === "ja" || stored.captionLanguage === "en"
          ? stored.captionLanguage
          : legacyLanguage,
    };
  } catch {
    return { ...DEFAULT_PLAYBACK_PREFERENCES };
  }
}

export function savePlaybackPreferences(value: PlaybackPreferences): boolean {
  if (typeof window === "undefined") return false;
  const safe: PlaybackPreferences = {
    rate: PLAYBACK_RATES.some((rate) => rate === value.rate) ? value.rate : 1,
    captionsEnabled: value.captionsEnabled === true,
    captionLanguage: value.captionLanguage === "en" ? "en" : "ja",
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}
