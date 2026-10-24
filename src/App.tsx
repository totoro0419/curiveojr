import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import {
  Home,
  Search,
  Library,
  Settings,
  Bell,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Play,
  Heart,
  Clock,
  Check,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  Cloud,
  Monitor,
  LogIn,
  LogOut,
  Bookmark,
  RotateCcw,
  Sigma,
  Languages,
  FlaskConical,
  Atom,
  BookOpen,
  Landmark,
  Globe,
  Binary,
  ExternalLink,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  catalog, inSubject, seriesInSubject, routeMap, routeSequence,
  videoMap,
  seriesMap,
  unitMap,
  subjectMap,
  channelMap,
  roleLabels,
  statusLabels,
  searchVideos,
  progress,
  time,
  videoHref,
} from "./catalog";
import type { Video, SubjectId, Series, LearningPatch } from "./types";
import { useLearning } from "./hooks/useLearning";
import { YouTubePlayer } from "./components/YouTubePlayer";
import { PLAYBACK_RATES, readPlaybackPreferences, savePlaybackPreferences, type PlaybackPreferences } from "./lib/playback-preferences";
import { SearchBox, SubjectTiles, SectionHeading, Thumb, VideoList, ProgressBar, CourseList, icons } from "./components/catalog-ui";
import { go, getReadyHierarchy, preloadHierarchy, useRoute, useViewState } from "./navigation/route";
import { useInteractionMotion, usePageMotion } from "./lib/motion";
import { Disclosure } from "./components/Disclosure";
import { SectionTabs } from "./components/SectionTabs";
import { usePwa } from "./hooks/usePwa";
import { durationSummary, durationTime, videoDuration, remainingPlaylistSeconds, remainingDurationLabel } from "./lib/duration";
import { resolveWatchList } from "./lib/watch-list-context";
import { watchPlaylistPage, WATCH_PLAYLIST_PAGE_SIZE } from "./lib/watch-playlist-page";
import { playlistLessonLabel } from "./lib/playlist-lesson-label";
import { WatchPlaylist } from "./components/WatchPlaylist";
import { VideoActions } from "./components/VideoActions";
import { collectAppNotices, type AppNotice } from "./lib/app-notifications";
import { selectResumeRecommendation } from "./lib/resume-selection";
const LazyHierarchyPage = lazy(preloadHierarchy);
const LazyLearningRoutePage=lazy(()=>preloadHierarchy().then(module=>({default:module.LearningRoutePage})));
const LazyCollectionPage = lazy(()=>preloadHierarchy().then(module=>({default:module.CollectionPage})));

type Learning = ReturnType<typeof useLearning>;
function SettingsGlyph({ count, size = 21 }: { count: number; size?: number }) {
  return (
    <span className="settings-glyph">
      <Settings size={size} aria-hidden="true" />
      {count > 0 && <span className="settings-alert-dot" aria-hidden="true" />}
    </span>
  );
}
const navItems = [
  { path: "/", label: "ホーム", icon: Home },
  { path: "/discover", label: "探す", icon: Search },
  { path: "/library", label: "マイライブラリ", icon: Library },
];
function HomePage({ learning }: { learning: Learning }) {
  const recent = Object.values(learning.records)
    .filter((r) => r.lastViewedAt > 0 && videoMap.has(r.videoId))
    .sort((a, b) => b.lastViewedAt - a.lastViewedAt);
  const recommendation = selectResumeRecommendation(catalog.videos, catalog.series, learning.records);
  const v = recommendation?.video;
  const resume = v ? learning.records[v.id] : undefined;
  const recentSeries = [
    ...new Set(recent.flatMap((r) => videoMap.get(r.videoId)?.seriesIds || [])),
  ]
    .slice(0, 3)
    .flatMap((id) => (seriesMap.get(id) ? [seriesMap.get(id)!] : []));
  const reviews = catalog.videos.filter(
    (v) =>
      learning.records[v.id]?.review ||
      learning.records[v.id]?.understanding === "review",
  );
  return (
    <>
      <header className="page-heading home-heading">
        <p className="eyebrow">YOUR JUNIOR LEARNING SPACE</p>
        <h1>{v ? "今日も、続きから。" : "学びたいことから、はじめよう。"}</h1>
        <p>授業を見つける。理解をつなぐ。自分のペースで進める。</p>
      </header>
      {v && recommendation && (
        <div className="resume-card">
          <a className="resume-panel" href={videoHref(v, recommendation.seriesId)}>
            <div className="resume-copy">
              <span className="eyebrow">{recommendation.kind === "next" ? "次の授業へ" : "続きから学ぶ"}</span>
              <h2>{v.title}</h2>
              <p>
                {subjectMap.get(v.subjectId)?.name} ·{" "}
                {unitMap.get(v.unitIds[0])?.name}
              </p>
              <span className="resume-action">
                <Play size={16} fill="currentColor" />
                {recommendation.kind === "next" ? "次の授業を始める" : `${time(resume?.position ?? 0)} から再開`}
              </span>
            </div>
            <Thumb video={v} />
          </a>
          <button
            type="button"
            className="resume-dismiss"
            disabled={!learning.ready}
            aria-label={`${v.title}を続きから学ぶの候補から除外`}
            title="この授業を候補から除外"
            onClick={() => void learning.save(v.id, { resumeDismissed: true }).catch(() => {})}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <SearchBox onSearch={(q) => go(`/discover?q=${encodeURIComponent(q)}`)} />
      <section className="section">
        <SectionHeading title={v ? "教科から学ぶ" : "何を学びますか？"} />
        <SubjectTiles learning={learning} />
      </section>
      {recentSeries.length > 0 && (
        <section className="section">
          <SectionHeading title="最近の講座" link="#/library?tab=history" />
          <CourseList courses={recentSeries} learning={learning} />
        </section>
      )}
      {reviews.length > 0 && (
        <a className="review-banner" href="#/library?tab=review">
          <RotateCcw size={20} />
          <span>
            <strong>復習に戻る</strong>
            <span>{reviews.length}授業を復習リストに登録しています</span>
          </span>
          <ArrowRight size={19} />
        </a>
      )}
    </>
  );
}
function DiscoverPage({
  learning,
  params,
}: {
  learning: Learning;
  params: URLSearchParams;
}) {
  const [mode, setMode] = useViewState("discover-mode", params.get("q") ? "search" : "subjects");
  const [query, setQuery] = useViewState("discover-query",params.get("q") || "");
  const [subject, setSubject] = useViewState("discover-subject","all");
  const [channel,setChannel]=useViewState("discover-channel","all");
  const [role, setRole] = useViewState("discover-role","all");
  const [status, setStatus] = useViewState("discover-status","all");
  useEffect(() => {
    setQuery(params.get("q") || "");
    if (params.get("q")) setMode("search");
  }, [params.get("q")]);
  const list = useMemo(
    () =>
      searchVideos(query).filter(
        (v) =>
          (subject === "all" || inSubject(v,subject)) &&
          (channel === "all" || v.channelId === channel) &&
          (role === "all" || v.role === role) &&
          (status === "all" || learning.get(v.id).status === status),
      ),
    [query, subject, channel, role, status, learning.records],
  );
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">FIND YOUR NEXT LESSON</p>
        <h1>探す</h1>
        <p>教科から。講座から。気になる言葉から。</p>
      </header>
      <SearchBox
        initial={query}
        onSearch={(q) => {
          setQuery(q);
          setMode("search");
          go(`/discover?q=${encodeURIComponent(q)}`);
        }}
      />
      <SectionTabs items={[{id:"subjects",label:"教科"},{id:"courses",label:"講座"},{id:"channels",label:"チャンネル"},...(mode==="search"?[{id:"search",label:"検索結果"}]:[])]} value={mode} onChange={setMode}/>
      <div id="discovery-panel" role="tabpanel" aria-labelledby={`discovery-panel-${mode}`} aria-label={mode==="search"?"検索結果":mode==="courses"?"講座":mode==="channels"?"チャンネル":"教科"} className="results-enter" key={mode}>
      {mode === "subjects" ? (
        <SubjectTiles learning={learning} />
      ) : mode === "courses" ? (
        <>
          <label className="filter-label">
            教科
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="all">すべての教科</option>
              {catalog.subjects.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {subject === "all" ? <><p className="section-intro">教科を選ぶと、チャンネル別の講座を表示します。</p><SubjectTiles learning={learning}/></> : catalog.channels.filter(channel=>catalog.series.some(series=>seriesInSubject(series,subject)&&series.channelId===channel.id)).map((channel,index)=><Disclosure key={channel.id} stateKey={`discover-channel:${channel.id}`} title={channel.name} defaultOpen={index===0}><CourseList courses={catalog.series.filter(series=>seriesInSubject(series,subject)&&series.channelId===channel.id)} learning={learning} subjectId={subject}/></Disclosure>)}
        </>
      ) : mode === "channels" ? (
        <div className="course-list">
          {catalog.channels.map((c) => {
            const count = catalog.videos.filter(
              (v) => v.channelId === c.id,
            ).length;
            return (
              <a className="course-row" href={`#/channel/${c.id}`} key={c.id}>
                <span className="course-mark">
                  <Play size={22} />
                </span>
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <span className="small muted">{count}授業</span>
                </div>
                <ChevronRight size={19} />
              </a>
            );
          })}
        </div>
      ) : (
        <>
          <div className="search-results-heading">
            <h2>
              {query ? `「${query}」` : "すべての授業"}
              <span>{list.length}件</span>
            </h2>
            <details className="filters">
              <summary>絞り込み</summary>
              <div className="filter-fields">
                <label>
                  教科
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option value="all">すべて</option>
                    {catalog.subjects.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  チャンネル
                  <select value={channel} onChange={event=>setChannel(event.target.value)}><option value="all">すべて</option>{catalog.channels.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
                </label>
                <label>
                  授業の種類
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="all">すべて</option>
                    {Object.entries(roleLabels).map(([id, label]) => (
                      <option value={id} key={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  学習状態
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">すべて</option>
                    {Object.entries(statusLabels).map(([id, label]) => (
                      <option value={id} key={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          </div>
          <VideoList videos={list} learning={learning} subjectId={subject==='all'?undefined:subject} contextLabel={query?"検索結果":"すべての授業"}/>
        </>
      )}
      </div>
    </>
  );
}
function LibraryPage({
  learning,
  params,
  notificationCount,
}: {
  learning: Learning;
  params: URLSearchParams;
  notificationCount: number;
}) {
  const tab = params.get("tab") || "continue";
  const entries = catalog.videos
    .filter((v) => {
      const r = learning.records[v.id];
      if (!r) return false;
      return tab === "continue"
        ? r.lastViewedAt > 0 && !r.playbackEnded && r.status !== "completed"
        : tab === "favorite"
          ? r.favorite
          : tab === "later"
            ? r.watchLater
            : tab === "review"
              ? r.review || r.understanding === "review"
              : r.lastViewedAt > 0;
    })
    .sort(
      (a, b) =>
        (learning.records[b.id]?.lastViewedAt ||
          learning.records[b.id]?.updatedAt ||
          0) -
        (learning.records[a.id]?.lastViewedAt ||
          learning.records[a.id]?.updatedAt ||
          0),
    );
  return (
    <>
      <header className="page-heading title-action">
        <div>
          <p className="eyebrow">YOUR LEARNING SPACE</p>
          <h1>マイライブラリ</h1>
          <p>続きから、好きな授業から、もう一度。</p>
        </div>
        <a
          href="#/settings"
          className="icon-button"
          aria-label={notificationCount ? `設定・通知${notificationCount}件` : "設定・同期・バックアップ"}
        >
          <SettingsGlyph count={notificationCount} size={22} />
        </a>
      </header>
      <div className="chips library-tabs">
        {[
          ["continue", "続きから"],
          ["later", "後で見る"],
          ["favorite", "お気に入り"],
          ["history", "視聴履歴"],
          ["review", "復習"],
          ["progress", "学習進捗"],
        ].map(([id, label]) => (
          <a
            key={id}
            className={tab === id ? "selected" : ""}
            href={`#/library?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </div>
      {tab === "progress" ? (
        <div className="progress-list">
          {catalog.subjects.map((s) => (
            <section key={s.id}>
              <a className="section-heading" href={`#/subject/${s.id}`}>
                <h2>{s.name}</h2>
                <ChevronRight size={18} />
              </a>
              <ProgressBar
                list={catalog.videos.filter((v) => inSubject(v,s.id))}
                learning={learning}
              />
            </section>
          ))}
        </div>
      ) : (
        <VideoList
          videos={entries}
          learning={learning}
          contextLabel={tab==="favorite"?"お気に入り":tab==="later"?"後で見る":tab==="review"?"復習":tab==="history"?"視聴履歴":"続きから"}
          empty={
            tab === "history"
              ? "まだ視聴履歴がありません。"
              : tab === "continue"
                ? "続きから見る授業はありません。"
                : tab === "favorite"
                  ? "お気に入りをここに。"
                  : tab === "review"
                    ? "復習する授業はまだありません。"
                    : "後で見たい授業をここに。"
          }
        />
      )}
      <a className="settings-link" href="#/settings">
        <Cloud size={17} />
        <span>{learning.syncState}</span>
        <span>
          設定・バックアップ
          <ChevronRight size={16} />
        </span>
      </a>
    </>
  );
}
function WatchPage({
  id,
  params,
  learning,
  notificationCount,
}: {
  id: string;
  params: URLSearchParams;
  learning: Learning;
  notificationCount: number;
}) {
  const v = videoMap.get(id);
  const [seek, setSeek] = useState<number | undefined>(()=>{const value=params.get("t");return value!==null&&Number.isFinite(Number(value))?Math.max(0,Number(value)):undefined;});
  const [seekNonce,setSeekNonce]=useState(0);
  useEffect(()=>{const value=params.get("t");if(value!==null&&Number.isFinite(Number(value))){setSeek(Math.max(0,Number(value)));setSeekNonce(n=>n+1);}},[params.get("t")]);
  const routeId=params.get("route")||undefined;
  const selection=useMemo(()=>resolveWatchList(id,params.get("series")||v?.seriesIds[0],routeId,params.get("playlist")||undefined),
    [id,params.get("series"),routeId,params.get("playlist")]);
  const sequence=selection.ids;
  const index=sequence.indexOf(id);
  const [episodePage,setEpisodePage]=useViewState("episode-page",Math.floor(Math.max(0,index)/WATCH_PLAYLIST_PAGE_SIZE));
  const [liveProgress,setLiveProgress]=useState<{videoId:string;time:number;duration:number;rate:number}|null>(null);
  if (!v) return <NotFound />;
  const subjectContext=params.get("subject")&&inSubject(v,params.get("subject")!)?params.get("subject")!:v.subjectId;
  const r = learning.get(id);
  const series = seriesMap.get(params.get("series") || v.seriesIds[0]);
  const learningRoute=routeId?routeMap.get(routeId):undefined;
  const steps=routeId?routeSequence(routeId):[];
  const activeProgress=liveProgress?.videoId===id?liveProgress:undefined;
  const remaining=remainingPlaylistSeconds(sequence.map(videoId=>videoMap.get(videoId)!).filter(Boolean),
    index,activeProgress?.time??(seek??(r.playbackEnded?0:r.position)),learning.records,activeProgress?.duration);
  const remainingRate=activeProgress?.rate??readPlaybackPreferences().rate;
  const nextLesson=videoMap.get(sequence[index+1]);
  const save = (patch: LearningPatch) => learning.save(id, patch).catch(() => {
    // useLearning publishes the error to the settings notification center.
  });
  // Advancing on purpose is stronger evidence of skipping than playback position.
  const markAdvancedLesson = () => {
    if (learning.ready && r.status !== "completed" && !r.playbackEnded)
      void save({ resumeDismissed: true });
  };
  const visiblePlaylist = watchPlaylistPage(sequence, episodePage);
  const playlistVideos = visiblePlaylist.entries.map(videoId=>videoMap.get(videoId)!).filter(Boolean);
  const playlist=(<>
        <div className="watch-sidebar">
          <p className="duration-summary">{sequence.length>WATCH_PLAYLIST_PAGE_SIZE?"表示中の授業 · ":""}{durationSummary(playlistVideos,learning.records)}</p>
          <p className="watch-remaining" aria-label="プレイリスト終了までの残り再生時間">{remaining===null?"残り時間は未取得":`ここから最後まで約${remainingDurationLabel(remaining,remainingRate)}`}{remaining!==null&&remainingRate!==1&&<small>（{remainingRate}倍速換算）</small>}</p>
          <div className="section-heading">
            <h2>{selection.scope?`${selection.title}の授業`:selection.title}</h2>
            <span className="small muted">
              {index + 1} / {sequence.length}
            </span>
          </div>
          <div className="episode-list" tabIndex={-1}>
            {visiblePlaylist.entries.map((videoId, offset) => {
              const i=visiblePlaylist.start+offset;
              const episode = videoMap.get(videoId);
              if (!episode) return null;
              const done = learning.records[videoId]?.status === "completed";
              const duration=videoDuration(episode,learning.records);
              const lessonLabel=playlistLessonLabel(episode);
              return (
                <div className="episode-row" key={videoId}>
                <a
                  href={videoHref(episode,steps.find(step=>step.videoId===episode.id)?.seriesId||series?.id,routeId,subjectContext,selection.scope)}
                  onClick={(event) => {
                    if (i > index && index >= 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
                      markAdvancedLesson();
                  }}
                  aria-current={videoId === id ? "page" : undefined}
                  className={videoId === id ? "active" : ""}
                >
                  <span className="episode-number">
                    {done ? (
                      <Check size={16} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="episode-thumb-wrap">
                    <Thumb video={episode} className="episode-thumbnail"/>
                    {videoId === id && <Play className="episode-playing-icon" size={15} fill="currentColor" aria-hidden="true"/>}
                  </span>
                  <span className="episode-copy">
                    <span className="episode-title" title={episode.title}>{lessonLabel.title}</span>
                    <small className="episode-duration">{[lessonLabel.detail,duration!==null?durationTime(duration):"時間未取得"].filter(Boolean).join(" · ")}</small>
                  </span>
                </a>
                <VideoActions video={episode} learning={learning}/>
                </div>
              );
            })}
          </div>
          {sequence.length>WATCH_PLAYLIST_PAGE_SIZE&&<div className="episode-pager"><button className="icon-button" aria-label="目次の前の30授業" disabled={visiblePlaylist.page===0} onClick={()=>setEpisodePage(visiblePlaylist.page-1)}><ArrowLeft size={16}/></button><span>{visiblePlaylist.start+1}–{visiblePlaylist.end}</span><button className="icon-button" aria-label="目次の次の30授業" disabled={visiblePlaylist.end>=sequence.length} onClick={()=>setEpisodePage(visiblePlaylist.page+1)}><ArrowRight size={16}/></button></div>}
        </div>
            {!!v.chapters?.length&&<div className="chapter-targets">{v.chapters.map((chapter,i)=><button className="text-button" key={i} onClick={()=>{setSeek(chapter.startSeconds);setSeekNonce(n=>n+1);}}>{time(chapter.startSeconds)} · {chapter.title}</button>)}</div>}
  </>);
  return (
    <>
      <div className="watch-toolbar">
        <a className="back-link" href={learningRoute?`#/route/${routeId}`:series?`#/course/${series.id}${subjectContext!==series.subjectId?`?subject=${subjectContext}`:""}`:`#/subject/${subjectContext}`}>
          <ArrowLeft size={17}/>講座に戻る
        </a>
        <div className="watch-toolbar-actions">
          <a className="icon-button watch-settings-link" href="#/settings" aria-label={notificationCount ? `設定・通知${notificationCount}件` : "設定"} title="設定・通知">
            <SettingsGlyph count={notificationCount} size={19} />
          </a>
        </div>
      </div>
      {v.notice&&<p className="notice" role="note">{v.notice}</p>}
        <div className="watch-layout">
        <WatchPlaylist currentId={id} index={index} count={sequence.length} page={visiblePlaylist.page}>{playlist}</WatchPlaylist>
        <div className="watch-main">
          {learning.ready?<YouTubePlayer key={id} video={v} record={r} save={learning.save} initialSeek={seek} seekNonce={seekNonce} onProgress={progress=>setLiveProgress({videoId:id,...progress})}/>:<div className="player-placeholder">学習記録を読み込んでいます…</div>}
          <div className="lesson-actions compact" aria-label="学習操作" aria-busy={!learning.ready}>
            <button className={`study-action ${r.status==="completed"?"completed":""}`} disabled={!learning.ready} aria-pressed={r.status==="completed"} aria-label={r.status==="completed"?"学習済みを解除":"学習済みにする"} onClick={()=>save({status:r.status==="completed"?"learning":"completed"})}>
              {r.status==='completed'?<CheckCircle2 size={16}/>:<Circle size={16}/>}<span>学習済み</span>
            </button>
            <button className="study-action icon-only" disabled={!learning.ready} aria-label={r.favorite?"お気に入りを解除":"お気に入りに登録"} aria-pressed={r.favorite} onClick={()=>save({favorite:!r.favorite})}>
              <Heart size={17} fill={r.favorite?"currentColor":"none"}/>
            </button>
            <button className="study-action icon-only" disabled={!learning.ready} aria-label={r.watchLater?"後で見るから解除":"後で見るに登録"} aria-pressed={r.watchLater} onClick={()=>save({watchLater:!r.watchLater})}>
              <Bookmark size={17} fill={r.watchLater?"currentColor":"none"}/>
            </button>
            {nextLesson&&<a className="watch-next study-next" href={videoHref(nextLesson,steps.find(step=>step.videoId===nextLesson.id)?.seriesId||series?.id,routeId,subjectContext,selection.scope)} onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
                markAdvancedLesson();
            }}>次の授業へ<ArrowRight size={16} aria-hidden="true"/></a>}
          </div>
        </div>
      </div>
    </>
  );
}
function SettingsPage({ learning, notifications }: { learning: Learning; notifications: AppNotice[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [playerPreferences, setPlayerPreferences] = useState(readPlaybackPreferences);
  const updatePlayerPreferences = (patch: Partial<PlaybackPreferences>) => {
    const next = { ...playerPreferences, ...patch };
    if (!savePlaybackPreferences(next)) {
      setMessage("再生設定をこの端末に保存できませんでした。ブラウザの保存設定を確認してください。");
      return;
    }
    setPlayerPreferences(next);
    setMessage("");
  };
  const pwa=usePwa();
  const action = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      if (success) setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a className="back-link" href="#/library">
        <ArrowLeft size={17} />
        マイライブラリ
      </a>
      <header className="page-heading">
        <h1>設定・データ管理</h1>
        <p>学習記録は、この端末に自動保存されます。</p>
      </header>
      <section className="settings-section settings-notifications" id="notifications" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">
          <Bell size={21} />
          通知
          {notifications.length > 0 && <span className="notification-total">{notifications.length}件</span>}
        </h2>
        {notifications.length === 0 ? (
          <p className="small muted">現在、確認が必要な通知はありません。</p>
        ) : (
          <ul className="notification-items">
            {notifications.map((notice) => (
              <li className="notification-item" key={notice.kind}>
                <span className="notification-symbol" aria-hidden="true">
                  {notice.kind === "learning" || notice.kind === "pwa" ? <AlertCircle size={18} /> : <Bell size={18} />}
                </span>
                <div className="notification-copy">
                  <strong>{notice.title}</strong>
                  <p>{notice.detail}</p>
                  {notice.kind === "learning" && learning.user && (
                    <button className="text-button notification-action" type="button" disabled={busy} onClick={() => void action(learning.retrySync)}>同期を再試行</button>
                  )}
                  {notice.kind === "pwa" && (
                    <button className="text-button notification-action" type="button" disabled={busy || pwa.applying} onClick={() => void action(pwa.checkForUpdate)}>更新を確認</button>
                  )}
                  {notice.kind === "update" && (
                    <button className="text-button notification-action" type="button" disabled={busy || pwa.applying} onClick={() => void action(pwa.applyUpdate)}>保存して更新</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="settings-section">
        <h2>
          <Cloud size={21} />
          端末間同期
        </h2>
        <p className="sync-status">{learning.syncState}</p>
        <p className="small muted">端末への保存状態：{learning.saveState}</p>
        {learning.user ? (
          <>
            <p>{learning.user.displayName || learning.user.email}</p>
            <div className="action-row">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => action(learning.retrySync)}
              >
                <RotateCcw size={17} />
                同期を再試行
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => action(learning.logout)}
              >
                <LogOut size={17} />
                ログアウト
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              {learning.configured
                ? "Googleでログインすると、端末間で学習記録を同期できます。"
                : "Firebaseが未設定のため、現在は端末内だけに保存しています。ローカルの全機能を利用できます。"}
            </p>
            <button
              className="button primary"
              disabled={busy || !learning.configured}
              onClick={() => action(learning.login)}
            >
              <LogIn size={17} />
              Googleでログイン
            </button>
            {!learning.configured && (
              <a
                className="text-link"
                href="https://github.com/totoro0419/curiveojr/blob/main/docs/firebase-setup.md"
                target="_blank"
                rel="noreferrer"
              >
                同期を有効にする手順
                <ExternalLink size={14} />
              </a>
            )}
          </>
        )}
      </section>
      <section className="settings-section">
        <h2>
          <Play size={21} />
          動画の再生設定
        </h2>
        <p>再生速度と字幕の初期設定を保存し、次の授業にも引き継ぎます。</p>
        <div className="playback-preference-fields">
          <label>
            <span>標準の再生速度</span>
            <select
              value={playerPreferences.rate}
              onChange={(event) => updatePlayerPreferences({ rate: Number(event.currentTarget.value) })}
            >
              {PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
            </select>
          </label>
          <label>
            <span>字幕（初期設定：OFF）</span>
            <select
              value={playerPreferences.captionsEnabled ? "on" : "off"}
              onChange={(event) => updatePlayerPreferences({ captionsEnabled: event.currentTarget.value === "on" })}
            >
              <option value="off">OFF</option>
              <option value="on">ON</option>
            </select>
          </label>
          {playerPreferences.captionsEnabled && (
            <label>
              <span>字幕の言語</span>
              <select
                value={playerPreferences.captionLanguage}
                onChange={(event) => updatePlayerPreferences({ captionLanguage: event.currentTarget.value as PlaybackPreferences["captionLanguage"] })}
              >
                <option value="ja">日本語</option>
                <option value="en">英語</option>
              </select>
            </label>
          )}
        </div>
        <p className="small muted">
          設定はこの端末に保存します。速度は動画が対応する倍率のみ適用されます。
          字幕ONは動画が対応する場合に適用されます。OFFはYouTube側の設定によっては表示されることがあり、完全な非表示は保証されません。
          字幕の変更は次の動画から適用されます。
        </p>
      </section>
      <section className="settings-section">
        <h2>
          <Download size={21} />
          バックアップ・復元
        </h2>
        <p>
          メモ、視聴位置、お気に入り、学習記録をJSONファイルで保存できます。復元は既存の記録と統合します。
        </p>
        <div className="action-row">
          <button
            className="button"
            disabled={busy || !learning.ready}
            onClick={() =>
              action(learning.exportBackup, "バックアップを書き出しました。")
            }
          >
            <Download size={17} />
            書き出す
          </button>
          <label className={`button file-button ${busy ? "disabled" : ""}`}>
            <Upload size={17} />
            バックアップを復元
            <input
              aria-label="バックアップファイルを選択"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  action(async () => {
                    const result = await learning.importBackup(file);
                    setMessage(`${result.count}件の学習記録を復元しました。`);
                  });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      <section className="settings-section">
        <h2>
          <Monitor size={21} />
          アプリとして使う
        </h2>
        <p>
          ブラウザの「ホーム画面に追加」または「アプリをインストール」から利用できます。オフラインでは収録一覧と学習記録を開けます。動画の再生には通信が必要です。
        </p>
        <p className="small muted">{pwa.installed?"アプリとして起動しています。":pwa.installAvailable?"このブラウザからインストールできます。":"ブラウザのメニューまたは共有から「ホーム画面に追加」を選んでください。"}</p>
        {pwa.installAvailable&&<button className="button primary" onClick={()=>void pwa.install().catch(()=>{})}><Download size={17}/>Curiveoをインストール</button>}
        <p className="small muted">{pwa.offlineReady?"オフライン用のアプリを端末に保存済み。":"オフライン用のアプリを準備中。初回はオンラインで開いてください。"}</p>
        <div className="action-row"><button className="button" disabled={pwa.applying} onClick={()=>void(pwa.updateAvailable?pwa.applyUpdate():pwa.checkForUpdate()).catch(()=>{})}><RotateCcw size={16}/>{pwa.applying?"記録を保存中…":pwa.updateAvailable?"保存して更新":"更新を確認"}</button></div>
      </section>
      <section className="settings-section">
        <h2>収録について</h2>
        <p>
          {catalog.videos.length.toLocaleString()}本・{catalog.series.length}
          講座。公式目次・公開プレイリストに基づき収録しています。動画の削除や埋め込み制限はYouTube側で変わるため、視聴できない場合は公式ページを利用してください。
        </p>
        <p className="small muted">
          収録更新: {new Date(catalog.updatedAt).toLocaleDateString("ja-JP")} ·
          Curiveo v1.1
        </p>
        {catalog.gaps.length > 0 && (
          <details>
            <summary>収録上の未確認・不足事項</summary>
            {catalog.gaps.map((g, i) => (
              <p key={i}>
                {channelMap.get(g.channelId||"")?.name||subjectMap.get(g.subjectId as SubjectId)?.name||"教材監査"}: {g.reason}
              </p>
            ))}
          </details>
        )}
        <a
          className="text-link"
          href="https://github.com/totoro0419/curiveojr"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
          <ExternalLink size={14} />
        </a>
      </section>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
function NotFound() {
  return (
    <div className="empty">
      <h1>このページは見つかりません。</h1>
      <a className="button primary" href="#/discover">
        授業を探す
      </a>
    </div>
  );
}
export function App() {
  const {route,direction} = useRoute();
  // React.lazy suspends on its first render even when import() is already cached.
  // Navigation awaits this module; render it directly so transitions capture the page.
  const hierarchy=getReadyHierarchy();
  const HierarchyPage=hierarchy?.default ?? LazyHierarchyPage;
  const LearningRoutePage=hierarchy?.LearningRoutePage ?? LazyLearningRoutePage;
  const CollectionPage=hierarchy?.CollectionPage ?? LazyCollectionPage;
  const mainRef=useRef<HTMLElement>(null);
  useInteractionMotion();
  useEffect(()=>{const preload=()=>{void preloadHierarchy().catch(()=>{});};if(typeof window.requestIdleCallback==="function"){const handle=window.requestIdleCallback(preload,{timeout:1000});return()=>window.cancelIdleCallback(handle);}const handle=setTimeout(preload,350);return()=>clearTimeout(handle);},[]);
  usePageMotion(mainRef,route.split("?")[0],direction);
  const pwa=usePwa();
  const [path, queryString = ""] = route.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(queryString);
  const learning = useLearning();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const notifications = collectAppNotices({
    learningError: learning.error,
    syncState: learning.syncState,
    pwaError: pwa.error,
    updateAvailable: pwa.updateAvailable,
    online,
  });
  const notificationCount = notifications.length;
  const current = parts[0] || "home";
  const navCurrent =
    current === "home"
      ? "/"
      : current === "library" || current === "settings"
        ? "/library"
        : "/discover";
  return (
    <div className={`app ${current === "watch" ? "watch-app" : ""}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        本文へ
      </a>
      <aside className="sidebar">
        <a className="brand" href="#/" aria-label="Curiveo">
          <img className="brand-symbol" src={`${import.meta.env.BASE_URL}brand/symbol.svg`} alt="" /><img className="brand-wordmark" src={`${import.meta.env.BASE_URL}brand/wordmark.svg`} alt="Curiveo Jr." />
        </a>
        <nav className="main-nav" aria-label="メインナビゲーション">
          {navItems.map((n) => (
            <a
              key={n.path}
              href={`#${n.path}`}
              aria-label={n.label}
              title={n.label}
              className={navCurrent === n.path ? "active" : ""}
              aria-current={navCurrent === n.path ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            <span className="status-dot" />
            学習記録は自動保存
          </p>
          <a href="#/settings" aria-label={notificationCount ? `設定・通知${notificationCount}件` : "設定・同期"} title="設定・通知">
            <SettingsGlyph count={notificationCount} size={19} />
            <span className="sidebar-setting-label">設定・同期</span>
          </a>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <a className="mobile-brand brand" href="#/">
            <img className="brand-symbol" src={`${import.meta.env.BASE_URL}brand/symbol.svg`} alt="" /><img className="brand-wordmark" src={`${import.meta.env.BASE_URL}brand/wordmark.svg`} alt="Curiveo Jr." />
          </a>
          <span className="desktop-kicker">学びを、つなぐ。</span>
          <div className="topbar-actions">
            <a
              className="icon-button"
              href="#/settings"
              aria-label={notificationCount ? `設定・通知${notificationCount}件` : "設定・同期・バックアップ"}
            >
              <SettingsGlyph count={notificationCount} />
            </a>
          </div>
        </header>
        <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
          <Suspense fallback={<div className="page-skeleton" role="status">講座を開いています…</div>}>{current === "home" ? (
            <HomePage learning={learning} />
          ) : current === "discover" ? (
            <DiscoverPage learning={learning} params={params} />
          ) : current === "subject" ? (
            <HierarchyPage key={path} subjectId={parts[1]} learning={learning} />
          ) : current === "route" ? (
            <LearningRoutePage key={path} id={parts[1]} learning={learning}/>
          ) : current === "category" ? (
            <HierarchyPage key={path} nodeId={parts[1]} learning={learning} />
          ) : current === "unit" ||
            current === "course" ||
            current === "channel" ? (
            <CollectionPage
              key={path}
              subjectId={params.get("subject")||undefined}
              kind={current}
              id={parts[1]}
              learning={learning}
            />
          ) : current === "library" ? (
            <LibraryPage learning={learning} params={params} notificationCount={notificationCount} />
          ) : current === "watch" ? (
            <WatchPage
              key={parts[1]}
              id={parts[1]}
              params={params}
              learning={learning}
              notificationCount={notificationCount}
            />
          ) : current === "settings" ? (
            <SettingsPage learning={learning} notifications={notifications} />
          ) : (
            <NotFound />
          )}
          </Suspense>
        </main>
        <footer className="footer">
          Curiveo <span>学びたい授業を、すぐそばに。</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
        {navItems.map((n) => (
          <a
            key={n.path}
            href={`#${n.path}`}
            className={navCurrent === n.path ? "active" : ""}
            aria-current={navCurrent === n.path ? "page" : undefined}
          >
            <n.icon size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
