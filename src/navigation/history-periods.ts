import type { SubjectId, Video } from "../types";

/** Era categories are display labels only. Canonical video IDs and course order are unchanged.
 * Japan: boundaries verified against the 001–200 numbered Historia Mundi lesson titles.
 * A provider chapter may cross a historical boundary (e.g. chapter 6), so the
 * 20-chapter grouping MUST NOT be used to assign a Japanese-history era. */
export const JAPANESE_HISTORY_PERIODS = [
  { through: 7, label: "縄文・弥生" },
  { through: 23, label: "古墳・飛鳥" },
  { through: 29, label: "奈良" },
  { through: 48, label: "平安" },
  { through: 61, label: "鎌倉" },
  { through: 77, label: "室町・南北朝" },
  { through: 88, label: "戦国・安土桃山" },
  { through: 123, label: "江戸" },
  { through: 130, label: "幕末" },
  { through: 155, label: "明治" },
  { through: 163, label: "大正" },
  { through: 187, label: "昭和" },
  { through: 189, label: "平成" },
  { through: 200, label: "近現代の文化史" },
] as const;

const WORLD_HISTORY_PERIODS = [
  { through: 3, label: "古代文明・地中海世界" },
  { through: 8, label: "アジア・イスラーム世界" },
  { through: 10, label: "中世ヨーロッパ" },
  { through: 12, label: "近世ヨーロッパ" },
  { through: 16, label: "近現代の欧米" },
  { through: 19, label: "近現代のアジア" },
  { through: 20, label: "戦後の世界" },
] as const;

/** The verified lesson number appears at the very start of every main course title. */
export function japaneseHistoryPeriodFromTitle(title: string): string | undefined {
  const match = title.normalize("NFKC").match(/^\s*(\d{3})(?=\D|$)/);
  if (!match) return undefined;
  const lesson = Number(match[1]);
  if (lesson < 1 || lesson > 200) return undefined;
  return JAPANESE_HISTORY_PERIODS.find(period => lesson <= period.through)?.label;
}

/** The World History curriculum remains region/period based on its source chapters. */
export function historyPeriod(subjectId: SubjectId, chapter: number): string | undefined {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 20) return undefined;
  if (subjectId !== "world-history") return undefined;
  return WORLD_HISTORY_PERIODS.find(period => chapter <= period.through)?.label;
}

export function historyPeriodFromUnit(subjectId: SubjectId, unitName: string): string | undefined {
  const chapter = Number(unitName.normalize("NFKC").match(/第\s*(\d+)\s*話/)?.[1]);
  return historyPeriod(subjectId, chapter);
}

/** The title is authoritative for Japan, because several provider chapters cross eras. */
export function historyPeriodForVideo(subjectId: SubjectId, video: Pick<Video, "title">, unitName: string): string | undefined {
  return subjectId === "japanese-history"
    ? japaneseHistoryPeriodFromTitle(video.title)
    : historyPeriodFromUnit(subjectId, unitName);
}
