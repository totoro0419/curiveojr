import {useEffect} from 'react';
import {ArrowLeft,BookOpen,ChevronRight,Play} from 'lucide-react';
import {videoHref} from '../catalog';
import {historyCoreVideos,historyCoreComplete,historyEras,historySupplementVideos} from '../navigation/history-study';
import {saveWatchList} from '../lib/watch-list-context';
import {listKey} from '../lib/list-key';
import {durationSummary} from '../lib/duration';
import {ProgressBar,VideoList} from '../components/catalog-ui';
import {BookmarkToggle} from '../components/NavigationBookmarks';
import type {Learning} from '../components/catalog-ui';

const scope='saved:'+listKey(historyCoreVideos.map(v=>v.id));

export default function HistoryStudyPage({section,eraId,learning}:{
 section?:string;eraId?:string;learning:Learning;
}){
 // The same 38-lesson study list is shared across eras. Next means the next
 // chronological lesson, never a random related video from another playlist.
 useEffect(()=>{if(historyCoreVideos.length)saveWatchList(scope,historyCoreVideos.map(v=>v.id),'歴史の授業 全範囲');},[]);
 const era=historyEras.find(row=>row.id===eraId);
 const breadcrumb=<nav className="breadcrumbs" aria-label="現在地"><ol>
  <li><a href="#/discover">探す</a></li>
  <li><a href="#/subject/japanese-history">社会</a></li>
  <li>{section?<a href="#/history">歴史</a>:<span aria-current="page">歴史</span>}</li>
  {section==='core'&&<li><span aria-current="page">全範囲の授業動画</span></li>}
  {section==='era'&&<><li><a href="#/history/core">全範囲の授業動画</a></li><li><span aria-current="page">{era?.title||'時代区分'}</span></li></>}
  {section==='supplement'&&<li><span aria-current="page">復習・発展</span></li>}
 </ol></nav>;
 const first=historyCoreVideos[0];
 const start=first?videoHref(first,undefined,undefined,undefined,scope):undefined;
 const back=section==='era'?'#/history/core':section?'#/history':'#/subject/japanese-history';
 const numbersLabel=historyCoreComplete?'第1〜38講':historyCoreVideos.length+'講（欠番を確認中）';
 return <>
  {breadcrumb}
  <a className="back-link" href={back}><ArrowLeft size={17}/>戻る</a>
  <BookmarkToggle kind="history" id={section==='era'&&era?'era/'+era.id:section==='core'?'core':section==='supplement'?'supplement':'index'}/>
  {section==='era'?era?<>
   <header className="page-heading"><p className="eyebrow">歴史の基本授業</p><h1>{era.title}</h1>
    <p>第{era.first}〜{era.last}講 · {era.videos.length}授業。時代順に学べます。</p></header>
   <ProgressBar list={era.videos} learning={learning}/>
   <VideoList videos={era.videos} learning={learning} contextLabel={era.title} playlistScope={scope}/>
  </>:<div className="empty"><h2>この時代は見つかりません</h2><a href="#/history/core">全範囲の授業へ</a></div>:
  section==='supplement'?<>
   <header className="page-heading"><p className="eyebrow">歴史 / 補助教材</p><h1>復習・補強の動画</h1>
    <p>第1〜38講の本編とは別の解説です。勉強法・告知・無関係な社会動画は除いて表示します。</p></header>
   <ProgressBar list={historySupplementVideos} learning={learning}/>
   <VideoList videos={historySupplementVideos} learning={learning} contextLabel="歴史の復習・補強"/>
  </>:
  section==='core'?<>
   <header className="page-heading"><p className="eyebrow">歴史 / 基礎授業のみ</p><h1>全範囲の授業動画</h1>
    <p>中学受験さくららチャンネルの連続授業 {numbersLabel}。勉強法、告知、総集編、発展動画を混ぜず、番号順で学びます。</p></header>
   <ProgressBar list={historyCoreVideos} learning={learning}/>
   <p className="duration-summary subject-duration-summary">{durationSummary(historyCoreVideos,learning.records)}</p>
   {start&&<a className="course-start interactive-card" href={start}><span className="start-play"><Play size={20} fill="currentColor"/></span><span><strong>第1講から順番に学ぶ</strong><small>{first.title}</small></span><ChevronRight size={19}/></a>}
   <section className="section"><div className="section-heading"><h2>時代を選ぶ</h2></div>
    <p className="section-intro">学びたい時代を選ぶと、その時代の授業だけが順番に表示されます。</p>
    <div className="hierarchy-grid">{historyEras.map(row=><a key={row.id} className="hierarchy-card interactive-card" href={'#/history/era/'+row.id}>
     <span className="category-mark"><BookOpen size={20}/></span><div><h2>{row.title}</h2><p>第{row.first}〜{row.last}講 · {row.videos.length}授業</p></div><ChevronRight size={18}/></a>)}</div>
   </section>
   <section className="section"><details className="disclosure"><summary>第1〜{historyCoreNumbersLast()}講の一覧をまとめて見る</summary>
    <VideoList videos={historyCoreVideos} learning={learning} contextLabel="歴史の基本授業" playlistScope={scope}/></details></section>
  </>:
  <>
   <header className="page-heading"><p className="eyebrow">社会 / 歴史</p><h1>歴史</h1>
    <p>まずは「全範囲の授業動画」を選び、学びたい時代へ進んでください。</p></header>
   <section className="section">
    <h2>何を学びますか？</h2>
    <div className="hierarchy-grid">
     <a className="hierarchy-card interactive-card" href="#/history/core"><span className="category-mark"><BookOpen size={20}/></span>
      <div><h2>全範囲の授業動画</h2><p>{numbersLabel} · 時代別に整理した本編だけ</p></div><ChevronRight size={18}/></a>
     {historySupplementVideos.length>0&&<a className="hierarchy-card interactive-card" href="#/history/supplement"><span className="category-mark"><BookOpen size={20}/></span>
      <div><h2>復習・補強の動画</h2><p>{historySupplementVideos.length}授業 · 本編のあとで学ぶ</p></div><ChevronRight size={18}/></a>}
    </div>
   </section>
  </>}
 </>;
}
function historyCoreNumbersLast(){return historyCoreComplete?38:historyCoreVideos.length;}
