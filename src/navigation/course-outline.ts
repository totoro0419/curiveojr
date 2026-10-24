import { unitMap, videoMap } from "../catalog";
import type { Series } from "../types";
export interface CourseChapter {id:string;title:string;videoIds:string[];}
export function courseOutline(series:Series):CourseChapter[]{
 const chunks:CourseChapter[]=[];
 for(const id of series.videoIds){
  const unit=videoMap.get(id)?.unitIds.map(uid=>unitMap.get(uid)).find(Boolean);
  const title=unit?.name||"授業一覧";
  const last=chunks[chunks.length-1];
  if(last?.title===title)last.videoIds.push(id);
  else chunks.push({id:series.id+"-chapter-"+chunks.length,title,videoIds:[id]});
 }
 return chunks;
}
