import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useViewState } from '../navigation/route';
import { motionEase, motionReduced } from '../lib/motion';

export function Disclosure({title,children,stateKey,defaultOpen=false,count,meta}:{title:string;children:ReactNode;stateKey:string;defaultOpen?:boolean;count?:number;meta?:string}){
 const id=useId();const [open,setOpen]=useViewState(stateKey,defaultOpen);
 const [rendered,setRendered]=useState(open);
 const body=useRef<HTMLDivElement>(null);const inner=useRef<HTMLDivElement>(null);
 const animation=useRef<Animation|undefined>(undefined);const initial=useRef(true);
 const initialStyle=useRef({height:open?'auto':'0px',opacity:open?1:0});
 useLayoutEffect(()=>{
  const element=body.current;const content=inner.current;if(!element||!content)return;
  if(open)setRendered(true);
  const start=element.getBoundingClientRect().height;
  const opacity=getComputedStyle(element).opacity;
  animation.current?.cancel();
  const finish=()=>{element.style.height=open?'auto':'0px';element.style.opacity=open?'1':'0';};
  if(initial.current||motionReduced()||typeof element.animate!=='function'){initial.current=false;finish();return;}
  const end=open?content.getBoundingClientRect().height:0;
  element.style.height=end+'px';element.style.opacity=open?'1':'0';
  const current=element.animate([{height:start+'px',opacity},{height:end+'px',opacity:open?1:0}],{duration:240,easing:motionEase});
  animation.current=current;
  void current.finished.then(()=>{if(animation.current===current)finish();},()=>{});
  // A rapid reversal measures the live height before cancelling the old effect.
 },[open]);
 useLayoutEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel=()=>animation.current?.finish();preference.addEventListener('change',cancel);
  return()=>{preference.removeEventListener('change',cancel);animation.current?.cancel();};
 },[]);
 return <section className={`disclosure ${open?'is-open':''}`}><h3><button className="disclosure-trigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><span className="disclosure-title"><span>{title}</span>{meta&&<small className="disclosure-meta">{meta}</small>}</span>{count!==undefined&&<span className="disclosure-count">{count}</span>}<ChevronDown size={18}/></button></h3><div ref={body} style={initialStyle.current} className="disclosure-body" id={id} aria-hidden={!open} inert={!open}><div ref={inner} className="disclosure-inner">{(open||rendered)&&children}</div></div></section>;
}
