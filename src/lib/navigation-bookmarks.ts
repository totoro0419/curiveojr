import {useSyncExternalStore} from 'react';
import {channelMap,routeMap,seriesMap,subjectMap,unitMap} from '../catalog';
import {learningNodes, nodeHref} from '../navigation/hierarchy';
import {historyEras} from '../navigation/history-study';

export type BookmarkKind='subject'|'category'|'course'|'channel'|'unit'|'route'|'history';
export type NavigationBookmark={kind:BookmarkKind;id:string;addedAt:number};
const STORAGE='curiveojr:navigation-bookmarks:v1';
const kinds=new Set<BookmarkKind>(['subject','category','course','channel','unit','route','history']);
const listeners=new Set<()=>void>();
let snapshot:NavigationBookmark[]|undefined;
function normalize(input:unknown):NavigationBookmark[]{
 if(!Array.isArray(input))return [];
 const seen=new Set<string>();
 return input.flatMap((item):NavigationBookmark[]=>{
  if(!item||typeof item!=='object')return [];
  const row=item as Record<string,unknown>;
  if(typeof row.kind!=='string'||!kinds.has(row.kind as BookmarkKind)||typeof row.id!=='string'||row.id.length>256)return [];
  const key=row.kind+':'+row.id;
  if(seen.has(key))return [];
  seen.add(key);
  return [{kind:row.kind as BookmarkKind,id:row.id,addedAt:typeof row.addedAt==='number'&&Number.isFinite(row.addedAt)?row.addedAt:0}];
 }).slice(0,100);
}
function read():NavigationBookmark[]{
 try{return normalize(JSON.parse(localStorage.getItem(STORAGE)||'[]'));}catch{return [];}
}
function getSnapshot(){return snapshot??(snapshot=read());}
function notify(){for(const fn of listeners)fn();}
function subscribe(fn:()=>void){
 listeners.add(fn);
 return()=>listeners.delete(fn);
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
 if(event.key===STORAGE||event.key===null){snapshot=read();notify();}
});
export function useNavigationBookmarks(){return useSyncExternalStore(subscribe,getSnapshot,()=>[] as NavigationBookmark[]);}
export function isNavigationBookmarked(kind:BookmarkKind,id:string,items=getSnapshot()){
 return items.some(item=>item.kind===kind&&item.id===id);
}
export function setNavigationBookmarked(kind:BookmarkKind,id:string,want:boolean){
 if(!kinds.has(kind)||typeof id!=='string'||id.length>256)return false;
 const now=getSnapshot();
 const existing=now.some(b=>b.kind===kind&&b.id===id);
 if(existing===want)return true;
 const next=want?[{kind,id,addedAt:Date.now()},...now].slice(0,100):now.filter(b=>b.kind!==kind||b.id!==id);
 try{localStorage.setItem(STORAGE,JSON.stringify(next));}
 catch{return false;}
 snapshot=next;notify();
 return true;
}
export function resolveNavigationBookmark(bookmark:NavigationBookmark){
 const {kind,id}=bookmark;
 if(kind==='subject'){const s=subjectMap.get(id as keyof typeof subjectMap extends never?never:any);return s?{title:s.name,href:'#/subject/'+encodeURIComponent(id),label:'教科'}:null;}
 if(kind==='category'){const node=learningNodes.get(id);return node?{title:node.title,href:nodeHref(node),label:'分野・単元'}:null;}
 if(kind==='course'){const s=seriesMap.get(id);return s?{title:s.title,href:'#/course/'+encodeURIComponent(id),label:'講座・プレイリスト'}:null;}
 if(kind==='channel'){const c=channelMap.get(id);return c?{title:c.name,href:'#/channel/'+encodeURIComponent(id),label:'チャンネル'}:null;}
 if(kind==='unit'){const u=unitMap.get(id);return u?{title:u.name,href:'#/unit/'+encodeURIComponent(id),label:'単元'}:null;}
 if(kind==='route'){const route=routeMap.get(id);return route?{title:route.title,href:'#/route/'+encodeURIComponent(id),label:'学習ルート'}:null;}
 if(kind==='history'){
  if(id==='index')return {title:'歴史',href:'#/history',label:'社会'};
  if(id==='core')return {title:'歴史・全範囲の授業動画',href:'#/history/core',label:'連続講義'};
  if(id==='supplement')return {title:'歴史・復習と補強',href:'#/history/supplement',label:'補助教材'};
  const era=historyEras.find(era=>'era/'+era.id===id);
  if(era)return {title:era.title,href:'#/history/era/'+era.id,label:'歴史の時代区分'};
 }
 return null;
}
