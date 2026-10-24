/** Global maintenance notices. Playback errors stay in the player itself.
 * This is a projection of live state, not a separate persistent error log. */
export type AppNoticeKind = "learning" | "pwa" | "update" | "offline";

export interface AppNotice {
  kind: AppNoticeKind;
  title: string;
  detail: string;
}

export function collectAppNotices(state: {
  learningError: string;
  syncState: string;
  pwaError: string;
  updateAvailable: boolean;
  online: boolean;
}): AppNotice[] {
  const notices: AppNotice[] = [];
  const learningError = state.learningError.trim();
  if (learningError || state.syncState.startsWith("同期できません")) {
    notices.push({
      kind: "learning",
      title: "学習記録・同期",
      detail:
        learningError ||
        "クラウドとの同期を確認できません。端末に保存された記録は設定画面からバックアップできます。",
    });
  }
  if (state.pwaError.trim()) {
    notices.push({
      kind: "pwa",
      title: "アプリの更新・保存",
      detail: state.pwaError.trim(),
    });
  }
  if (state.updateAvailable) {
    notices.push({
      kind: "update",
      title: "アプリの更新",
      detail: "新しいバージョンが利用できます。学習記録を保存してから更新できます。",
    });
  }
  if (!state.online) {
    notices.push({
      kind: "offline",
      title: "オフライン",
      detail: "動画の再生とクラウド同期には通信が必要です。端末内の学習記録は引き続き利用できます。",
    });
  }
  return notices;
}
