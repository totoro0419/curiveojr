import { useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { RefObject } from 'react';

export const motionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motionEase = 'cubic-bezier(.22,1,.36,1)';
const spring = (t:number) => 1 - Math.exp(-7.5*t)*(Math.cos(10*t)+.75*Math.sin(10*t));
// Normalize both endpoints, including interrupted button presses.
export const springSamples = Array.from({length:33},(_,i)=>spring(i/32)/spring(1));
let selectedSubject: string | undefined;
let activeTransition: ViewTransition | undefined;
let transitionVersion = 0;
let fallbackCopy:HTMLElement|undefined;
let fallbackAnimations:Animation[]=[];
function cancelFallback(){fallbackAnimations.forEach(animation=>animation.cancel());fallbackAnimations=[];fallbackCopy?.remove();fallbackCopy=undefined;}

/** Connect old/new surfaces without cloning or re-mounting live players. */
export function transitionSurface(update:()=>void, direction:'forward'|'back'|'replace', from:string, to:string, section=false) {
 const version=++transitionVersion;
 activeTransition?.skipTransition();
 cancelFallback();
 const root=document.documentElement;
 delete root.dataset.routeMotion;delete root.dataset.sectionMotion;
 document.querySelectorAll<HTMLElement>('[data-shared-icon]').forEach(el=>el.style.removeProperty('view-transition-name'));
 const eligible=!motionReduced()&&!from.startsWith('/watch/')&&!to.startsWith('/watch/')&&(section||from!==to);
 if(!eligible){selectedSubject=undefined;flushSync(update);return;}
 if(typeof document.startViewTransition!=='function'){
  selectedSubject=undefined;
  const selector=section?'.results-enter[role="tabpanel"]':'#main-content';
  const outgoing=document.querySelector<HTMLElement>(selector);
  const rect=outgoing?.getBoundingClientRect();
  const copy=outgoing?.cloneNode(true) as HTMLElement|undefined;
  const opacity=outgoing?getComputedStyle(outgoing).opacity:'1';
  const background=outgoing&&getComputedStyle(outgoing).backgroundColor!=='rgba(0, 0, 0, 0)'?getComputedStyle(outgoing).backgroundColor:getComputedStyle(document.body).backgroundColor;
  root.dataset[section?'sectionMotion':'routeMotion']='fallback';
  root.dataset.motionDirection=direction;
  flushSync(update);
  if(copy&&rect){
   copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
   copy.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]').forEach(el=>el.tabIndex=-1);
   copy.setAttribute('aria-hidden','true');copy.inert=true;copy.classList.add('motion-snapshot-copy');
   const nav=document.querySelector<HTMLElement>('.mobile-nav');const bottom=nav?.getBoundingClientRect().height||0;
   copy.style.cssText='position:fixed;z-index:20;pointer-events:none;overflow:hidden;margin:0;max-width:none;background:'+background+';left:'+rect.x+'px;top:'+rect.y+'px;width:'+rect.width+'px;height:'+Math.max(0,Math.min(rect.height,innerHeight-rect.y-bottom))+'px;opacity:'+opacity+';';
   document.body.append(copy);fallbackCopy=copy;
   fallbackAnimations.push(copy.animate([{opacity,transform:'translate3d(0,0,0)'},{opacity:0,transform:'translate3d('+(direction==='back'?10:-10)+'px,0,0)'}],{duration:180,easing:motionEase,fill:'forwards'}));
  }
  const incoming=document.querySelector<HTMLElement>(selector);
  if(incoming)fallbackAnimations.push(incoming.animate([{opacity:0,transform:'translate3d('+(direction==='back'?-10:10)+'px,0,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:200,easing:motionEase}));
  void Promise.allSettled(fallbackAnimations.map(animation=>animation.finished)).then(()=>{
   if(version!==transitionVersion)return;cancelFallback();delete root.dataset.routeMotion;delete root.dataset.sectionMotion;
  });
  return;
 }
 root.dataset.motionDirection=direction;
 root.dataset[section?'sectionMotion':'routeMotion']='native';
 if(!section&&selectedSubject){
  const marker=[...document.querySelectorAll<HTMLElement>('[data-shared-icon]')].find(el=>el.dataset.sharedIcon===selectedSubject);
  if(marker)marker.style.viewTransitionName='curiveo-subject';
 }
 // Always commit input. Each navigation callback guards its own history entry, so a
 // visual cancellation or an intervening tab press cannot discard navigation.
 const transition=document.startViewTransition(()=>flushSync(update));
 activeTransition=transition;
 void transition.finished.catch(()=>{}).finally(()=>{
  if(version!==transitionVersion)return;
  activeTransition=undefined;selectedSubject=undefined;
  delete root.dataset.routeMotion;delete root.dataset.sectionMotion;
  document.querySelectorAll<HTMLElement>('[data-shared-icon]').forEach(el=>el.style.removeProperty('view-transition-name'));
 });
}

export function useInteractionMotion(){useEffect(()=>{
 if(typeof Element.prototype.animate!=='function')return;
 const animations=new WeakMap<Element,Animation>();
 const active=new Set<Animation>();
 const presses=new Map<number,HTMLElement>();
 const currentScale=(element:HTMLElement)=>{const value=parseFloat(getComputedStyle(element).scale);return Number.isFinite(value)?value:1;};
 const animate=(element:HTMLElement,target:number,release=false)=>{
  const start=currentScale(element);const prior=animations.get(element);
  prior?.cancel();if(prior)active.delete(prior);
  if(motionReduced()||Math.abs(target-start)<.0001)return;
  const frames=release?springSamples.map((value,i)=>({scale:String(start+(target-start)*value),offset:i/32})):[{scale:String(start)},{scale:String(target)}];
  // Individual scale does not overwrite the component's transform animation.
  const animation=element.animate(frames,{duration:release?240:90,easing:release?'linear':motionEase,fill:release?'none':'forwards'});
  animations.set(element,animation);active.add(animation);
  if(release)void animation.finished.catch(()=>{}).finally(()=>active.delete(animation));
 };
 const press=(event:PointerEvent)=>{
  if(motionReduced()||event.button!==0||!(event.target instanceof Element))return;
  const element=event.target.closest<HTMLElement>('button:not(:disabled), a.interactive-card, a.subject-tile, a.course-row, .hierarchy-card');
  if(!element||element.closest('.player-frame'))return;
  presses.set(event.pointerId,element);animate(element,.975);
 };
 const release=(event:PointerEvent)=>{const element=presses.get(event.pointerId);presses.delete(event.pointerId);if(element)animate(element,1,true);};
 const remember=(event:MouseEvent)=>{
  selectedSubject=undefined;
  if(motionReduced()||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!(event.target instanceof Element))return;
  const marker=event.target.closest<HTMLAnchorElement>('a[href^="#/"]')?.querySelector<HTMLElement>('[data-shared-icon]');
  selectedSubject=marker?.dataset.sharedIcon;
 };
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 const cancel=()=>{active.forEach(animation=>animation.cancel());active.clear();presses.clear();selectedSubject=undefined;activeTransition?.skipTransition();cancelFallback();};
 document.addEventListener('pointerdown',press,{passive:true});document.addEventListener('pointerup',release,{passive:true});document.addEventListener('pointercancel',release,{passive:true});document.addEventListener('click',remember,true);window.addEventListener('blur',cancel);preference.addEventListener('change',cancel);
 return()=>{document.removeEventListener('pointerdown',press);document.removeEventListener('pointerup',release);document.removeEventListener('pointercancel',release);document.removeEventListener('click',remember,true);window.removeEventListener('blur',cancel);preference.removeEventListener('change',cancel);cancel();};
},[]);}

export function usePageMotion(ref:RefObject<HTMLElement|null>,routeKey:string,direction:'forward'|'back'|'replace'){
 const previous=useRef('');
 useLayoutEffect(()=>{
  const element=ref.current;if(!element||previous.current===routeKey)return;
  const first=!previous.current;previous.current=routeKey;
  if(document.documentElement.dataset.routeMotion==='fallback')return;
  if(document.documentElement.dataset.routeMotion==='native'){
   const marker=[...element.querySelectorAll<HTMLElement>('[data-shared-icon]')].find(el=>el.dataset.sharedIcon===selectedSubject);
   if(marker)marker.style.viewTransitionName='curiveo-subject';
   return;
  }
  // Saving, filters and player settings never replay this effect.
  if(motionReduced()||typeof element.animate!=='function'||routeKey.startsWith('/watch/'))return;
  const offset=direction==='back'?-10:first?0:12;
  const animation=element.animate([{opacity:0,transform:'translate3d('+offset+'px,0,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:180,easing:motionEase});
  return()=>animation.cancel();
 },[routeKey,direction]);
}
