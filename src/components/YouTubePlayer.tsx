import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import type { LearningPatch, LearningRecord, Video } from "../types";
import { registerUpdateGuard } from "../lib/pwa";
import { readPlaybackPreferences, savePlaybackPreferences } from "../lib/playback-preferences";

interface Player {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  setPlaybackRate(rate: number): void;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  // Not documented as a stable method: best effort when YouTube honors it.
  unloadModule?(module: string): void;
}
interface YouTubeApi {
  Player: new (
    target: HTMLIFrameElement,
    options: Record<string, unknown>,
  ) => Player;
}
declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;
function loadPlayerApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      if (error) {
        apiPromise = null;
        script.remove();
        reject(error);
      } else if (window.YT?.Player) resolve(window.YT);
      else {
        apiPromise = null;
        reject(new Error("YouTubeプレーヤーを読み込めませんでした。"));
      }
    };
    const timeout = window.setTimeout(
      () =>
        finish(
          new Error(
            "YouTubeへの接続に時間がかかっています。再試行してください。",
          ),
        ),
      15000,
    );
    window.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } finally {
        finish();
      }
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () =>
      finish(
        new Error("YouTubeに接続できませんでした。接続を確認してください。"),
      );
    document.head.append(script);
  });
  return apiPromise;
}

interface Playback {
  time: number;
  duration: number;
  state: number;
  rate: number;
  rates: number[];
  volume: number;
  muted: boolean;
}
const initialPlayback: Playback = {
  time: 0,
  duration: 0,
  state: -1,
  rate: 1,
  rates: [1],
  volume: 100,
  muted: false,
};
function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(value % 60).padStart(2, "0")}`;
}

export function YouTubePlayer({
  video,
  record,
  save,
  initialSeek,
  seekNonce,
  onProgress,
}: {
  video: Video;
  record: LearningRecord;
  save: (id: string, patch: LearningPatch) => Promise<void>;
  initialSeek?: number;
  seekNonce?: number;
  onProgress?: (progress: {time:number;duration:number;rate:number}) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const saveRef = useRef(save);
  const onProgressRef = useRef(onProgress);
  const recordRef = useRef(record);
  const positionRef = useRef(record.playbackEnded ? 0 : record.position);
  const mountedVideoId = useRef(video.id);
  const initialSeekRef = useRef(initialSeek);
  const pendingSeek = useRef<number | undefined>(initialSeek);
  const seeking = useRef(false);
  const pendingWrites = useRef(new Set<Promise<void>>());
  const savePositionRef = useRef<
    (ended?: boolean, forcedPosition?: number) => Promise<void>
  >(() => Promise.resolve());
  const lastVolume = useRef(100);
  const [playerPreferences, setPlayerPreferences] = useState(readPlaybackPreferences);
  const preferencesRef = useRef(playerPreferences);
  preferencesRef.current = playerPreferences;
  const [playback, setPlayback] = useState(initialPlayback);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  saveRef.current = save;
  onProgressRef.current = onProgress;
  recordRef.current = record;
  initialSeekRef.current = initialSeek;

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === root.current);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let player: Player | null = null;
    let ready = false;
    let hasStarted = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let readinessTimer: ReturnType<typeof setTimeout> | undefined;
    let bufferingTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSavedAt = 0;
    let lastSavedPosition = -1;
    // Count real playing time, not the seek position or the amount jumped.
    const watchedBase = recordRef.current.watchedSeconds ?? 0;
    let watchedInSession = 0;
    let lastSavedWatched = Math.floor(watchedBase);
    let watchSample: { mediaTime: number; wallTime: number } | null = null;
    let reportedProgress: {time:number;duration:number;rate:number} | null = null;
    if (mountedVideoId.current !== video.id) {
      mountedVideoId.current = video.id;
      positionRef.current = recordRef.current.playbackEnded
        ? 0
        : recordRef.current.position;
    }
    pendingSeek.current = initialSeekRef.current ?? positionRef.current;
    setState("loading");
    setError("");
    setNotice("");
    setSaveError("");
    setPlayback({ ...initialPlayback, time: pendingSeek.current ?? 0 });
    setSeekPreview(null);
    seeking.current = false;

    const write = (patch: LearningPatch): Promise<void> => {
      const saving = Promise.resolve()
        .then(() => saveRef.current(video.id, patch))
        .then(() => {
          if (!disposed) setSaveError("");
        })
        .catch((reason: unknown) => {
          lastSavedPosition = -1;
          lastSavedWatched = -1;
          if (!disposed)
            setSaveError(
              "再生位置を保存できませんでした。端末の空き容量を確認してください。",
            );
          throw reason;
        });
      pendingWrites.current.add(saving);
      void saving.then(
        () => pendingWrites.current.delete(saving),
        () => pendingWrites.current.delete(saving),
      );
      return saving;
    };
    const persist = async (
      ended = false,
      forcedPosition?: number,
    ): Promise<void> => {
      if (!ready || !player) return;
      const duration = Math.max(0, player.getDuration() || 0);
      const position = Math.max(
        0,
        Math.min(duration, forcedPosition ?? player.getCurrentTime() ?? 0),
      );
      // A loading/cued player reporting zero must never erase a saved resume position.
      if (
        !duration ||
        (!position && !hasStarted && !ended && forcedPosition === undefined)
      )
        return;
      positionRef.current = position;
      const watchedSeconds = Math.floor(watchedBase + watchedInSession);
      if (
        Math.floor(position) === lastSavedPosition &&
        watchedSeconds === lastSavedWatched &&
        !ended &&
        forcedPosition === undefined
      )
        return;
      lastSavedPosition = Math.floor(position);
      lastSavedWatched = watchedSeconds;
      lastSavedAt = Date.now();
      await write({
        position: Math.floor(position),
        duration: Math.floor(duration),
        playbackEnded: ended,
        ...(watchedSeconds > 0 || recordRef.current.watchedSeconds !== undefined
          ? { watchedSeconds }
          : {}),
      });
    };
    savePositionRef.current = persist;
    const persistQuietly = (ended = false, forcedPosition?: number) => {
      void persist(ended, forcedPosition).catch(() => {});
    };
    const unregisterUpdateGuard = registerUpdateGuard(async () => {
      const currentPosition = persist(
        player?.getPlayerState() === 0,
        seeking.current ? positionRef.current : undefined,
      );
      const waitForWrites = async (writes: Promise<void>[]) => {
        const results = await Promise.allSettled(writes);
        const failed = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (failed) throw failed.reason;
      };
      await waitForWrites([currentPosition, ...pendingWrites.current]);
      while (pendingWrites.current.size)
        await waitForWrites([...pendingWrites.current]);
    });
    const applyPreferredCaptionOff = () => {
      if (disposed || !ready || !player || preferencesRef.current.captionsEnabled) return;
      // YouTube has no documented force-OFF parameter. Some iframe player
      // versions support unloading the captions module; never rely on it alone.
      try {
        player.unloadModule?.("captions");
      } catch {
        // Keep playback running if the host does not support this operation.
      }
    };
    const applyPreferredRate = () => {
      if (disposed || !ready || !player) return;
      const rates = player.getAvailablePlaybackRates();
      if (!rates?.length) return;
      // A player may initially report [1] before video metadata is ready.
      if (rates.length === 1 && rates[0] === 1 && player.getPlayerState() !== 1)
        return;
      const preferred = preferencesRef.current.rate;
      const chosen = rates.includes(preferred)
        ? preferred
        : rates.reduce((best, rate) =>
            Math.abs(rate - preferred) < Math.abs(best - preferred) ? rate : best
          );
      if (Math.abs((player.getPlaybackRate() || 1) - chosen) > 0.001)
        player.setPlaybackRate(chosen);
    };
    const syncControls = () => {
      if (disposed || !ready || !player) return;
      const duration = Math.max(0, player.getDuration() || 0);
      const time = Math.max(0, player.getCurrentTime() || 0);
      const playing = player.getPlayerState() === 1;
      if (playing && !seeking.current && !document.hidden) {
        const now = performance.now();
        if (watchSample) {
          const elapsed = (now - watchSample.wallTime) / 1000;
          const advanced = time - watchSample.mediaTime;
          const rate = Math.max(0.25, player.getPlaybackRate() || 1);
          // Skip gaps caused by seeks, tab throttling, buffering and stalled media.
          if (elapsed > 0 && elapsed < 2.5 &&
              advanced >= elapsed * rate * 0.25 &&
              advanced <= elapsed * rate * 2.5) {
            watchedInSession += Math.min(elapsed, advanced / rate);
          }
        }
        watchSample = { mediaTime: time, wallTime: now };
      } else {
        watchSample = null;
      }
      if (!seeking.current && (hasStarted || time > 0))
        positionRef.current = time;
      const availableRates = player.getAvailablePlaybackRates();
      const rate = player.getPlaybackRate() || 1;
      if (onProgressRef.current && (!reportedProgress ||
          Math.abs(reportedProgress.time-time) >= 5 || reportedProgress.duration !== duration || reportedProgress.rate !== rate)) {
        reportedProgress = {time,duration,rate};
        onProgressRef.current(reportedProgress);
      }
      setPlayback((current) => ({
        time: seeking.current ? current.time : time,
        duration,
        state: player!.getPlayerState(),
        rate: player!.getPlaybackRate() || 1,
        rates: availableRates?.length ? availableRates : [1],
        volume: player!.getVolume(),
        muted: player!.isMuted(),
      }));
    };
    const onHidden = () => {
      if (document.hidden) persistQuietly();
    };
    const onPageHide = () => persistQuietly();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    loadPlayerApi()
      .then((api) => {
        if (disposed || !container.current) return;
        const iframe = document.createElement("iframe");
        iframe.title = video.title;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow =
          "autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope; web-share";
        iframe.allowFullscreen = true;
        const params = new URLSearchParams({
          enablejsapi: "1",
          controls: "0",
          playsinline: "1",
          autoplay: "0",
          start: String(Math.floor(Math.max(0, pendingSeek.current ?? 0))),
          origin: window.location.origin,
          rel: "0",
          hl: "ja",
        });
        const { captionsEnabled, captionLanguage } = preferencesRef.current;
        if (captionsEnabled) {
          params.set("cc_load_policy", "1");
          params.set("cc_lang_pref", captionLanguage);
        }
        // OFF omits cc_load_policy; YouTube account preferences may override.
        iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(video.id)}?${params}`;
        container.current.replaceChildren(iframe);
        readinessTimer = setTimeout(() => {
          if (!disposed) {
            setState("error");
            setError(
              "YouTubeプレーヤーに接続できませんでした。再試行するか、YouTubeで開いてください。",
            );
          }
        }, 20000);
        player = new api.Player(iframe, {
          width: "100%",
          height: "100%",
          events: {
            onReady: (event: { target: Player }) => {
              if (disposed) return;
              player = event.target;
              ready = true;
              playerRef.current = player;
              clearTimeout(readinessTimer);
              setState("ready");
              applyPreferredRate();
              applyPreferredCaptionOff();
              syncControls();
              timer = setInterval(() => {
                syncControls();
                if (
                  player?.getPlayerState() === 1 &&
                  Date.now() - lastSavedAt >= 10000
                )
                  persistQuietly();
              }, 500);
            },
            onStateChange: (event: { data: number }) => {
              if (disposed || !ready) return;
              applyPreferredCaptionOff();
              if (event.data === 3) {
                if (!bufferingTimer) {
                  bufferingTimer = setTimeout(() => {
                    bufferingTimer = undefined;
                    if (!disposed && player?.getPlayerState() === 3) {
                      setState("error");
                      setError(
                        "動画の読み込みが停止しています。接続を確認して再試行するか、YouTubeで開いてください。",
                      );
                    }
                  }, 30000);
                }
              } else {
                clearTimeout(bufferingTimer);
                bufferingTimer = undefined;
              }
              if (event.data === 1) {
                hasStarted = true;
                setState("ready");
                setError("");
                setNotice("");
                void write({
                  lastViewedAt: Date.now(),
                  playbackEnded: false,
                  ...(recordRef.current.status === "unstarted"
                    ? { status: "learning" as const }
                    : {}),
                }).catch(() => {});
              }
              if (event.data === 0) persistQuietly(true);
              if (event.data === 2) persistQuietly();
              if (event.data === 1 || event.data === 5) applyPreferredRate();
              syncControls();
            },
            onPlaybackRateChange: syncControls,
            onAutoplayBlocked: () => {
              if (!disposed)
                setNotice(
                  "ブラウザが再生を保留しました。映像内のYouTube再生ボタンを押してください。",
                );
            },
            onError: (event: { data: number }) => {
              if (disposed) return;
              clearTimeout(readinessTimer);
              setState("error");
              setError(
                event.data === 101 || event.data === 150
                  ? "この動画は埋め込み再生が許可されていません。YouTubeで開いてください。"
                  : event.data === 153
                    ? "YouTubeが再生元を確認できませんでした。再試行するか、YouTubeで開いてください。"
                    : "この動画を再生できませんでした。公開状態や接続を確認してください。",
              );
            },
          },
        });
      })
      .catch((reason: unknown) => {
        if (disposed) return;
        setState("error");
        setError(
          reason instanceof Error
            ? reason.message
            : "YouTubeプレーヤーを読み込めませんでした。",
        );
      });
    return () => {
      persistQuietly();
      disposed = true;
      unregisterUpdateGuard();
      clearInterval(timer);
      clearTimeout(readinessTimer);
      clearTimeout(bufferingTimer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      playerRef.current = null;
      savePositionRef.current = () => Promise.resolve();
      player?.destroy();
    };
    // Learning updates never recreate the iframe. Only changing the video or retrying does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, attempt]);

  useEffect(() => {
    if (initialSeek === undefined) return;
    pendingSeek.current = Math.max(0, initialSeek);
    const player = playerRef.current;
    if (!player) return;
    const time = Math.max(
      0,
      Math.min(player.getDuration() || initialSeek, initialSeek),
    );
    player.seekTo(time, true);
    positionRef.current = time;
    setPlayback((current) => ({ ...current, time }));
    void savePositionRef.current(false, time).catch(() => {});
  }, [initialSeek, seekNonce, attempt]);

  const seekTo = (seconds: number, commit: boolean) => {
    const player = playerRef.current;
    if (!player || state !== "ready" || !playback.duration) return;
    const time = Math.max(0, Math.min(playback.duration, seconds));
    player.seekTo(time, commit);
    positionRef.current = time;
    setPlayback((current) => ({ ...current, time }));
    setSeekPreview(commit ? null : time);
    if (commit) {
      seeking.current = false;
      void savePositionRef.current(false, time).catch(() => {});
    }
  };
  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player || state !== "ready") return;
    if ([1, 3].includes(player.getPlayerState())) player.pauseVideo();
    else player.playVideo();
  };
  const changeVolume = (volume: number) => {
    const player = playerRef.current;
    if (!player || state !== "ready") return;
    player.setVolume(volume);
    if (volume > 0) {
      lastVolume.current = volume;
      player.unMute();
    }
    setPlayback((current) => ({
      ...current,
      volume,
      muted: volume > 0 ? false : current.muted,
    }));
  };
  const updatePlayerPreferences = (patch: Partial<typeof playerPreferences>) => {
    const next = { ...preferencesRef.current, ...patch };
    if (!savePlaybackPreferences(next)) {
      setNotice("再生設定をこの端末に保存できませんでした。ブラウザの保存設定を確認してください。");
      return false;
    }
    preferencesRef.current = next;
    setPlayerPreferences(next);
    return true;
  };
  const changeRate = (rate: number) => {
    if (updatePlayerPreferences({ rate })) playerRef.current?.setPlaybackRate(rate);
  };
  const changeCaptions = (captionsEnabled: boolean) => {
    if (updatePlayerPreferences({ captionsEnabled })) {
      if (!captionsEnabled) {
        // Best effort for the current video without destroying its iframe.
        try { playerRef.current?.unloadModule?.("captions"); } catch { /* unsupported by this player */ }
      }
      setNotice("字幕の初期設定を保存しました。次の動画から適用されます。");
    }
  };
  const changeCaptionLanguage = (captionLanguage: typeof playerPreferences.captionLanguage) => {
    if (updatePlayerPreferences({ captionLanguage }))
      setNotice("字幕の言語を保存しました。次の動画から適用されます。");
  };
  const toggleMute = () => {
    const player = playerRef.current;
    if (!player || state !== "ready") return;
    if (player.isMuted() || player.getVolume() === 0) {
      player.unMute();
      if (!player.getVolume()) player.setVolume(lastVolume.current);
      setPlayback((current) => ({
        ...current,
        muted: false,
        volume: player.getVolume(),
      }));
    } else {
      player.mute();
      setPlayback((current) => ({ ...current, muted: true }));
    }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === root.current)
        await document.exitFullscreen();
      else if (root.current?.requestFullscreen)
        await root.current.requestFullscreen();
      else setNotice("このブラウザでは全画面表示を利用できません。");
    } catch {
      setNotice(
        "全画面表示を開始できませんでした。ブラウザの設定を確認してください。",
      );
    }
  };
  const active = state === "ready";
  const playing = [1, 3].includes(playback.state);
  const displayTime = seekPreview ?? playback.time;
  const muted = playback.muted || playback.volume === 0;
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}&t=${Math.floor(displayTime)}s`;

  return (
    <div className="player-shell" ref={root}>
      <div
        className="player-frame"
        ref={container}
        style={{ aspectRatio: "16 / 9", minHeight: 200 }}
      />
      <div className="player-controls">
        <div className="player-seek">
          <span className="player-time">{formatTime(displayTime)}</span>
          <input
            type="range"
            min={0}
            max={playback.duration || 1}
            step={1}
            value={Math.min(
              displayTime,
              playback.duration || Math.max(displayTime, 1),
            )}
            disabled={!active || !playback.duration}
            aria-label="再生位置"
            aria-valuetext={`${formatTime(displayTime)} / ${formatTime(playback.duration)}`}
            onPointerDown={() => {
              seeking.current = true;
            }}
            onChange={(event) =>
              seekTo(Number(event.currentTarget.value), false)
            }
            onPointerUp={(event) =>
              seekTo(Number(event.currentTarget.value), true)
            }
            onPointerCancel={(event) =>
              seekTo(Number(event.currentTarget.value), true)
            }
            onKeyUp={(event) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                  "End",
                  "PageUp",
                  "PageDown",
                ].includes(event.key)
              )
                seekTo(Number(event.currentTarget.value), true);
            }}
            onBlur={(event) => {
              if (seekPreview !== null)
                seekTo(Number(event.currentTarget.value), true);
            }}
          />
          <span className="player-time">{formatTime(playback.duration)}</span>
        </div>
        <div className="player-control-row">
          <button
            type="button"
            className="icon-button"
            disabled={!active || !playback.duration}
            onClick={() => seekTo(playback.time - 10, true)}
            aria-label="10秒戻る"
            title="10秒戻る"
          >
            <RotateCcw size={20} />
            <span className="skip-seconds">10</span>
          </button>
          <button
            type="button"
            className="button player-play"
            disabled={!active}
            onClick={togglePlayback}
            aria-label={playing ? "一時停止" : "再生"}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
            <span>{playing ? "一時停止" : "再生"}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!active || !playback.duration}
            onClick={() => seekTo(playback.time + 10, true)}
            aria-label="10秒進む"
            title="10秒進む"
          >
            <RotateCcw size={20} style={{ transform: "scaleX(-1)" }} />
            <span className="skip-seconds">10</span>
          </button>
          <label className="player-rate">
            <span className="visually-hidden">再生速度</span>
            <select
              value={playback.rate}
              disabled={!active}
              onChange={(event) => changeRate(Number(event.currentTarget.value))}
            >
              {playback.rates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}×
                </option>
              ))}
            </select>
          </label>
          <label className="player-captions">
            <span className="visually-hidden">字幕ON・OFF</span>
            <select
              value={playerPreferences.captionsEnabled ? "on" : "off"}
              aria-label="字幕ON・OFF"
              onChange={(event) => changeCaptions(event.currentTarget.value === "on")}
            >
              <option value="off">字幕: OFF</option>
              <option value="on">字幕: ON</option>
            </select>
          </label>
          {playerPreferences.captionsEnabled && (
            <label className="player-captions">
              <span className="visually-hidden">字幕の言語</span>
              <select
                value={playerPreferences.captionLanguage}
                aria-label="字幕の言語"
                onChange={(event) => changeCaptionLanguage(event.currentTarget.value as typeof playerPreferences.captionLanguage)}
              >
                <option value="ja">日本語</option>
                <option value="en">英語</option>
              </select>
            </label>
          )}
          <div className="player-volume">
            <button
              type="button"
              className="icon-button"
              disabled={!active}
              onClick={toggleMute}
              aria-label={muted ? "ミュート解除" : "ミュート"}
              aria-pressed={muted}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={muted ? 0 : playback.volume}
              disabled={!active}
              aria-label="音量"
              aria-valuetext={`${muted ? 0 : playback.volume}%`}
              onChange={(event) =>
                changeVolume(Number(event.currentTarget.value))
              }
            />
          </div>
          <button
            type="button"
            className="icon-button player-fullscreen"
            onClick={() => {
              void toggleFullscreen();
            }}
            aria-label={fullscreen ? "全画面表示を終了" : "全画面表示"}
            title={fullscreen ? "全画面表示を終了" : "全画面表示"}
          >
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
      {state === "loading" && (
        <p className="notice" role="status">
          YouTubeプレーヤーを読み込んでいます…
        </p>
      )}
      {state === "error" && (
        <div className="notice player-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button"
            onClick={() => setAttempt((current) => current + 1)}
          >
            <RotateCcw size={16} />
            再試行
          </button>
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-link">
            YouTubeで再生する<ExternalLink size={14}/>
          </a>
        </div>
      )}
      {offline && (
        <p className="notice" role="status">
          <WifiOff size={16} />
          オフラインです。動画の再生には通信が必要です。学習記録は端末に保存します。
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {saveError && (
        <p className="notice" role="alert">
          {saveError}
        </p>
      )}
      <div className="player-footer">
        <span>再生位置は自動保存</span>
      </div>
    </div>
  );
}
