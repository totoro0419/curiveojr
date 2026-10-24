import { catalog, videoMap } from "../catalog";
import type { Series, SubjectId } from "../types";
const roleRank={core:0,reinforcement:1,exam:2,advanced:3};
const levelOrder=["入門","基礎","基本","標準","応用","発展","中学受験"];
export function compareLevels(_subjectId:SubjectId,a:string,b:string){
 const rank=(x:string)=>{const i=levelOrder.findIndex(label=>x.includes(label));return i<0?levelOrder.length:i;};
 return rank(a)-rank(b);
}
export function compareCategory(_subjectId:SubjectId,_parent:string,a:string,b:string){
 return a.localeCompare(b,"ja");
}
export function sortCourses(courses:Series[]):Series[]{
 return [...courses].sort((a,b)=>{
  const ai=catalog.subjects.findIndex(s=>s.id===a.subjectId);
  const bi=catalog.subjects.findIndex(s=>s.id===b.subjectId);
  const role=(s:Series)=>Math.min(9,...s.videoIds.map(id=>roleRank[videoMap.get(id)!.role]));
  return ai-bi||compareLevels(a.subjectId,a.level,b.level)||role(a)-role(b)||
  catalog.series.findIndex(s=>s.id===a.id)-catalog.series.findIndex(s=>s.id===b.id);
 });
}
