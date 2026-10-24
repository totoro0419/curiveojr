import durations from '../data/video-durations.json';
import durationStatuses from '../data/duration-status.json';
import type { Video, LearningRecord } from '../types';
const metadata=durations as Record<string,number>;
const statuses=durationStatuses as Record<string,string>;
function isAccepted(id:string){const status=statuses[id]??'';return /^(verified|accepted)@/.test(status)&&Date.parse(status.split('@')[1])>Date.now();}
export function videoDuration(video:Video,records:Record<string,LearningRecord>={}){
 const candidates=[metadata[video.id],video.durationSeconds,records[video.id]?.duration];
 return candidates.find((value):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0)??null;
}
export function durationTime(seconds:number){
 const value=Math.floor(Math.max(0,seconds));const hours=Math.floor(value/3600);
 return (hours?hours+':'+String(Math.floor(value%3600/60)).padStart(2,'0'):String(Math.floor(value/60)))+':'+String(value%60).padStart(2,'0');
}
export function totalDuration(videos:Video[],records:Record<string,LearningRecord>={}){
 const unique=[...new Map(videos.map(video=>[video.id,video])).values()];
 let seconds=0,missing=0,unverified=0;
 for(const video of unique){const duration=videoDuration(video,records);if(duration===null)missing++;else {seconds+=duration;if(!isAccepted(video.id))unverified++;}}
 return {seconds:Math.floor(seconds),missing,unverified,total:unique.length};
}
export function durationSummary(videos:Video[],records:Record<string,LearningRecord>={}){
 const result=totalDuration(videos,records);
 if(!result.total)return '合計 0:00';
 if(result.missing===result.total)return '合計時間未取得（'+result.missing+'本）';
 const hours=Math.floor(result.seconds/3600),minutes=Math.floor(result.seconds%3600/60),seconds=result.seconds%60;
 const label=(hours?hours+'時間':'')+(minutes?minutes+'分':'')+seconds+'秒';
 const notes=[result.missing?result.missing+'本の時間は未取得':'',result.unverified?result.unverified+'本の出典は再確認中':''].filter(Boolean);
 return notes.length?'記録済み '+label+' · '+notes.join(' · '):'合計 '+label;
}

/** Remaining content duration from the selected lesson through the end of its source playlist.
 * Unlike the visible 30-row pagination, this always includes all following lessons. */
export function remainingPlaylistSeconds(
  videos: Video[], index: number, position: number,
  records: Record<string, LearningRecord> = {}, currentDuration?: number,
): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= videos.length) return null;
  let seconds = 0;
  for (let i = index; i < videos.length; i++) {
    const fallback = videoDuration(videos[i], records);
    const duration = i === index && typeof currentDuration === 'number' &&
      Number.isFinite(currentDuration) && currentDuration > 0 ? currentDuration : fallback;
    if (duration === null) return null;
    seconds += i === index
      ? Math.max(0, duration - Math.min(duration, Math.max(0, Number.isFinite(position) ? position : 0)))
      : duration;
  }
  return Math.ceil(seconds);
}
export function remainingDurationLabel(seconds: number, rate = 1): string {
  const validRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const minutes = Math.ceil(Math.max(0, seconds) / validRate / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}時間${minutes % 60 ? `${minutes % 60}分` : ''}` : `${minutes}分`;
}
