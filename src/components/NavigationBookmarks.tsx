import {Bookmark,ChevronRight,BookOpen} from 'lucide-react';
import {useState} from 'react';
import {isNavigationBookmarked,resolveNavigationBookmark,setNavigationBookmarked,useNavigationBookmarks} from '../lib/navigation-bookmarks';
import type {BookmarkKind} from '../lib/navigation-bookmarks';

export function BookmarkToggle({kind,id}:{kind:BookmarkKind;id:string}){
 const items=useNavigationBookmarks();
 const active=isNavigationBookmarked(kind,id,items);
 const [error,setError]=useState(false);
 return <span className="bookmark-control"><button type="button" className={'bookmark-toggle '+(active?'is-saved':'')} aria-label={active?'ホームのブックマークから外す':'ホームにブックマーク'} title={active?'ブックマークを解除':'ホームにブックマーク'} aria-pressed={active} onClick={()=>{
   setError(!setNavigationBookmarked(kind,id,!active));
  }}><Bookmark size={18} fill={active?'currentColor':'none'}/><span>{active?'保存済み':'ブックマーク'}</span></button>
 {error&&<span role="alert" className="bookmark-error">保存できません。端末の保存設定を確認してください。</span>}</span>;
}
export function HomeBookmarks(){
 const bookmarks=useNavigationBookmarks();
 const entries=bookmarks.flatMap(bookmark=>{
  const resolved=resolveNavigationBookmark(bookmark);
  return resolved?[{bookmark,...resolved}]:[];
 });
 if(!entries.length)return null;
 return <section className="section bookmarked-section" aria-label="ブックマークした教材">
  <div className="section-heading"><h2><Bookmark size={19} fill="currentColor"/> ブックマーク</h2><span className="small muted">{entries.length}件</span></div>
  <p className="section-intro">保存した講座・プレイリスト・単元へ直接戻れます。</p>
  <div className="bookmark-list">{entries.map(({bookmark,href,title,label})=><div className="bookmark-item" key={bookmark.kind+':'+bookmark.id}>
   <a className="bookmark-link" href={href}><span className="bookmark-type"><BookOpen size={16}/>{label}</span><strong>{title}</strong><ChevronRight size={18}/></a>
   <BookmarkToggle kind={bookmark.kind} id={bookmark.id}/>
  </div>)}</div>
 </section>;
}
