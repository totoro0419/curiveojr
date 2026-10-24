import type { LearningRecord, Series, Video } from "../types";

export type ResumeChoice = {
  video: Video;
  kind: "resume" | "next";
  previousVideoId?: string;
  seriesId?: string;
};

/**
 * Actual time spent playing is preferable to the seek position. Legacy records
 * do not have watchedSeconds, so apply a conservative position-only fallback.
 * A seek position alone can never reliably prove that a lecture was watched.
 */
function meaningfulViewing(record: LearningRecord, video: Video): boolean {
  const duration = record.duration > 0 ? record.duration : video.durationSeconds ?? 0;
  if (typeof record.watchedSeconds === "number") {
    const minimum = duration > 0 ? Math.min(40, Math.max(20, duration * 0.03)) : 25;
    return record.watchedSeconds >= minimum;
  }
  const legacyMinimum = duration > 0
    ? Math.min(150, Math.max(65, duration * 0.12))
    : 90;
  return record.position >= legacyMinimum;
}

function nearlyFinished(record: LearningRecord, video: Video): boolean {
  const duration = record.duration > 0 ? record.duration : video.durationSeconds ?? 0;
  if (duration <= 0) return false;
  return duration - record.position <= Math.min(35, Math.max(10, duration * 0.05));
}

/**
 * Prefer the most recently meaningfully studied lesson, not the most recently
 * opened lesson. Deliberately dismissed lessons never become home suggestions.
 * After finishing a lesson, offer the first unfinished following lesson within
 * an actual course; do not invent a course context from unrelated units.
 */
export function selectResumeRecommendation(
  videos: Video[],
  series: Series[],
  records: Record<string, LearningRecord>,
): ResumeChoice | null {
  const videosById = new Map(videos.map((video) => [video.id, video]));
  const seriesById = new Map(series.map((course) => [course.id, course]));
  const visits = Object.values(records)
    .filter((record) => record.lastViewedAt > 0 && videosById.has(record.videoId))
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt);

  for (const record of visits) {
    const video = videosById.get(record.videoId)!;
    if (record.resumeDismissed) continue;
    const finished = record.status === "completed" || record.playbackEnded || nearlyFinished(record, video);
    if (!meaningfulViewing(record, video) && record.status !== "completed") continue;

    if (!finished && record.status === "learning") {
      return { video, kind: "resume", seriesId: video.seriesIds[0] };
    }

    if (finished) {
      for (const seriesId of video.seriesIds) {
        const course = seriesById.get(seriesId);
        if (!course) continue;
        const currentIndex = course.videoIds.indexOf(video.id);
        if (currentIndex < 0) continue;
        for (const nextId of course.videoIds.slice(currentIndex + 1)) {
          const nextVideo = videosById.get(nextId);
          if (!nextVideo) continue;
          const nextRecord = records[nextId];
          if (nextRecord?.status === "completed" || nextRecord?.playbackEnded || nextRecord?.resumeDismissed)
            continue;
          return { video: nextVideo, kind: "next", previousVideoId: video.id, seriesId };
        }
      }
    }
  }
  return null;
}
