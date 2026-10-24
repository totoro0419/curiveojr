import { useEffect, useId, useRef, useState } from 'react';
import { Bookmark, Check, CheckCircle2, Circle, Heart, MoreHorizontal, EyeOff } from 'lucide-react';
import type { Video, LearningPatch } from '../types';
import type { useLearning } from '../hooks/useLearning';

/** Learning commands stay outside the navigation link. Native popovers handle
 * light dismissal, Escape, and keyboard order without a second menu framework. */
export function VideoActions({video,learning}:{video:Video;learning:ReturnType<typeof useLearning>}) {
 const id=useId();
 const trigger=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLDivElement>(null);
 const pending=useRef(false);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const record=learning.get(video.id);
 const place=()=>{
  const button=trigger.current;const menu=panel.current;if(!button||!menu)return;
  const rect=button.getBoundingClientRect();const width=Math.min(224,innerWidth-24);
  menu.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';
  menu.style.top=Math.max(12,rect.bottom+206>innerHeight?rect.top-202:rect.bottom+4)+'px';
 };
 useEffect(()=>{
  if(!open)return;
  const close=()=>panel.current?.hidePopover();
  window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
  return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
 },[open]);
 const save=async(patch:LearningPatch)=>{
  if(pending.current)return;
  pending.current=true;
  const button=trigger.current;const list=button?.closest<HTMLElement>('.video-list,.episode-list');
  setBusy(true);
  try {await learning.save(video.id,patch);}catch{/* The shared learning error banner reports failed writes. */}
  finally {pending.current=false;setBusy(false);if(button&&!button.isConnected)list?.focus({preventScroll:true});}
 };
 const items=[
  {label:'学習済み',selected:record.status==='completed',icon:record.status==='completed'?<CheckCircle2 size={17}/>:<Circle size={17}/>,patch:{status:record.status==='completed'?'learning':'completed'} as LearningPatch},
  {label:'お気に入り',selected:record.favorite,icon:<Heart size={17} fill={record.favorite?'currentColor':'none'}/>,patch:{favorite:!record.favorite}},
  {label:'保存（後で見る）',selected:record.watchLater,icon:<Bookmark size={17} fill={record.watchLater?'currentColor':'none'}/>,patch:{watchLater:!record.watchLater}},
  {label:'続きからの候補から除外',selected:record.resumeDismissed===true,icon:<EyeOff size={17}/>,patch:{resumeDismissed:!record.resumeDismissed}},
 ];
 return <div className="video-actions">
  <button ref={trigger} type="button" className="video-actions-trigger" disabled={!learning.ready} popoverTarget={id} aria-controls={id} aria-expanded={open} aria-label={`学習操作：${video.title}`} title="学習済み・お気に入り・保存"><MoreHorizontal size={19}/></button>
  <div ref={panel} id={id} popover="auto" role="group" aria-label={`${video.title}の学習操作`} className="video-actions-panel" onBeforeToggle={event=>{if(event.newState==='open')place();}} onToggle={event=>setOpen(event.newState==='open')}>
   {items.map(item=><button key={item.label} type="button" disabled={!learning.ready} aria-disabled={busy||!learning.ready} aria-pressed={item.selected} onClick={()=>void save(item.patch)}>{item.icon}<span>{item.label}</span>{item.selected&&<Check size={15}/>}</button>)}
  </div>
 </div>;
}
