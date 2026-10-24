import { catalog, seriesInSubject, videoMap, seriesMap } from "../catalog";
import type { Series, SubjectId, Video } from "../types";
export interface LearningNode {
 id:string;subjectId:SubjectId;parentId?:string;title:string;description:string;
 kind:"subject"|"level"|"field"|"unit"|"topic";children:string[];videoIds:string[];
 targets?:{videoId:string;startSeconds:number;title:string}[];evidence:string;sourceUnitIds:string[];
}
export const learningNodes=new Map<string,LearningNode>();
export const hierarchyRoots={} as Record<SubjectId,string>;
const videoLeaves=new Map<string,string[]>();
const videoRank=new Map(catalog.videos.map((video,index)=>[video.id,index]));
const unitRank=new Map(catalog.units.map((unit,index)=>[unit.id,index]));
const nodeVideoIds=new Map<string,Set<string>>();
function add(id:string,subjectId:SubjectId,title:string,kind:LearningNode["kind"],parentId?:string):LearningNode{
 const result={id,subjectId,parentId,title,kind,description:title+"の授業を探す",children:[],videoIds:[],
 evidence:"公開動画の元単元名から作成した分類",sourceUnitIds:[]} as LearningNode;
 learningNodes.set(id,result);nodeVideoIds.set(id,new Set());
 if(parentId)learningNodes.get(parentId)!.children.push(id);
 return result;
}
for(const subject of catalog.subjects){
 const rootId="subject-"+subject.id;hierarchyRoots[subject.id]=rootId;
 add(rootId,subject.id,subject.name,"subject");
}
const fieldIds=new Map<string,string>();
for(const unit of catalog.units){
 const fieldKey=unit.subjectId+":"+unit.field;
 let fieldId=fieldIds.get(fieldKey);
 if(!fieldId){fieldId="field-"+fieldKey;fieldIds.set(fieldKey,fieldId);
 add(fieldId,unit.subjectId,unit.field,"field",hierarchyRoots[unit.subjectId]);}
 const item=add("unit-"+unit.id,unit.subjectId,unit.name,"unit",fieldId);
 item.sourceUnitIds.push(unit.id);
}
for(const video of catalog.videos){
 for(const unitId of video.unitIds){
  const leaf=learningNodes.get("unit-"+unitId);if(!leaf)continue;
  const list=videoLeaves.get(video.id)||[];list.push(leaf.id);videoLeaves.set(video.id,list);
  for(let node:LearningNode|undefined=leaf;node;node=node.parentId?learningNodes.get(node.parentId):undefined){
    if(!nodeVideoIds.get(node.id)!.has(video.id)){nodeVideoIds.get(node.id)!.add(video.id);node.videoIds.push(video.id);}
    if(!node.sourceUnitIds.includes(unitId))node.sourceUnitIds.push(unitId);
  }
 }
}
for(const node of learningNodes.values()){
 node.videoIds.sort((a,b)=>videoRank.get(a)!-videoRank.get(b)!);
 node.children.sort((a,b)=>{const left=learningNodes.get(a)!,right=learningNodes.get(b)!;
  const idx=(n:LearningNode)=>Math.min(...n.sourceUnitIds.map(id=>unitRank.get(id)??-1).filter(i=>i>=0));
  return idx(left)-idx(right);});
}
export function getNodePath(id:string){const arr:LearningNode[]=[];
 let node=learningNodes.get(id);while(node){arr.unshift(node);node=node.parentId?learningNodes.get(node.parentId):undefined;}return arr;}
export function nodeVideos(id:string):Video[]{return (learningNodes.get(id)?.videoIds||[]).flatMap(id=>{const v=videoMap.get(id);return v?[v]:[];});}
export function videoNodePath(videoId:string){return getNodePath(videoLeaves.get(videoId)?.[0]||"");}
export function nodeHref(node:LearningNode){return node.kind==="subject"?"#/subject/"+node.subjectId:"#/category/"+node.id;}
export function primarySeriesFor(node:LearningNode):Series|undefined{
 const candidates=catalog.series.filter(s=>seriesInSubject(s,node.subjectId)&&s.videoIds.some(id=>node.videoIds.includes(id)));
 return candidates.sort((a,b)=>b.videoIds.filter(id=>node.videoIds.includes(id)).length-a.videoIds.filter(id=>node.videoIds.includes(id)).length)[0];
}
