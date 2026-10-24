import { useLayoutEffect, useRef } from 'react';
import { currentRoute } from '../navigation/route';
import { transitionSurface } from '../lib/motion';

export function SectionTabs({items,value,onChange,panelId="discovery-panel",label="探し方"}:{items:{id:string;label:string}[];value:string;onChange:(id:string)=>void;panelId?:string;label?:string}){
 const root=useRef<HTMLDivElement>(null);const indicator=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const element=root.current;const mark=indicator.current;if(!element||!mark)return;
  const align=()=>{const selected=element.querySelector<HTMLElement>('[aria-selected="true"]');if(!selected)return;mark.style.width=selected.offsetWidth+'px';mark.style.transform='translate3d('+selected.offsetLeft+'px,0,0)';mark.dataset.ready='true';};
  align();const observer=new ResizeObserver(align);observer.observe(element);return()=>observer.disconnect();
 },[value]);
 const select=(id:string)=>{if(id===value)return;const direction=items.findIndex(i=>i.id===id)<items.findIndex(i=>i.id===value)?'back':'forward';transitionSurface(()=>onChange(id),direction,currentRoute(),currentRoute(),true);};
 return <div ref={root} className="section-tabs" role="tablist" aria-label={label}><span ref={indicator} className="tab-indicator" aria-hidden="true"/>{items.map((item,index)=><button key={item.id} id={panelId+'-'+item.id} role="tab" aria-selected={value===item.id} aria-controls={panelId} tabIndex={value===item.id?0:-1} onClick={()=>select(item.id)} onKeyDown={event=>{const step=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;const next=step?(index+step+items.length)%items.length:event.key==='Home'?0:event.key==='End'?items.length-1:-1;if(next<0)return;event.preventDefault();select(items[next].id);document.getElementById(panelId+'-'+items[next].id)?.focus();}}>{item.label}</button>)}</div>;
}
