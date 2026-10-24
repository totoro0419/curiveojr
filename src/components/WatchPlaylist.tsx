import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Disclosure } from './Disclosure';

const wide=()=>window.matchMedia('(min-width:840px)').matches;
const subscribe=(update:()=>void)=>{const query=window.matchMedia('(min-width:840px)');query.addEventListener('change',update);return()=>query.removeEventListener('change',update);};

export function WatchPlaylist({children,currentId,index,count,page}:{children:ReactNode;currentId:string;index:number;count:number;page:number}) {
 const beside=useSyncExternalStore(subscribe,wide,()=>false);
 const root=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const list=root.current?.querySelector<HTMLElement>('.episode-list');
  if(!list || list.clientHeight===0)return;
  const active=list.querySelector<HTMLElement>('a[aria-current="page"]');
  if(!active){list.scrollTop=0;return;}
  // The list, not the outer sidebar, is the sole scrollbar in wide layouts.
  // Constrain the position so the last row (including its time) remains reachable.
  const desired=active.offsetTop-(list.clientHeight-active.clientHeight)/2;
  list.scrollTop=Math.max(0,Math.min(desired,list.scrollHeight-list.clientHeight));
 },[beside,currentId,page]);
 return <aside ref={root} className="watch-playlist" aria-label="プレイリスト">{beside?children:<Disclosure stateKey="watch-playlist-mobile" title={`授業 ${index+1} / ${count}`}>{children}</Disclosure>}</aside>;
}
