import type { Video } from '../types';

export interface PlaylistLessonLabel {
  /** Display-only lesson name, not the YouTube video headline. */
  title: string;
  /** Differentiates lessons with the same topic. */
  detail: string;
}

const subjectTag = /【(?:超わかる[！!]?高校[^】]*|超わかる[！!]?中学[^】]*|高校(?:数学|化学|英語|英文法|物理)[^】]*|中学(?:数学|英語)[^】]*|物理基礎|高校物理|物理|漢文|古文)】/g;
const promoTag = /【(?:完全網羅|完全保存版|永久保存版|保存版|完全版|決定版|有料級|衝撃|実用的|この1本でOK|これ1本でOK|総集編|基礎[〜～~]応用網羅|学ばないと大損)】/g;
const whitespace = (s: string) => s.replace(/[\s　]+/g, ' ').trim();

/** Never changes canonical titles, search, playback state or IDs. */
export function playlistLessonLabel(video: Pick<Video, 'title' | 'channelId' | 'topic'>): PlaylistLessonLabel {
  const original = whitespace(video.title);
  const normalized = original.replace(/＃/g, '#').replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xFF10));
  const lecture = normalized.match(/【第\s*(\d+)\s*講】|(?:\[\s*統計\s*#(\d+)\s*\])/);
  const trailingNumber = normalized.match(/[#]\s*(\d+)(?!.*#\s*\d+)/);
  const number = trailingNumber?.[1] ?? lecture?.[1] ?? lecture?.[2];
  const kind = normalized.match(/[〜～~]\s*(授業|演習)\s*[〜～~]/)?.[1] ??
    normalized.match(/【(?:漢文基礎講座[^】]*)(解説編|演習編)】/)?.[1]?.replace('編','') ??
    normalized.match(/(?:^|[】\s])(?:授業|演習)[〜～~]/)?.[0]?.match(/授業|演習/)?.[0];

  let title = original;
  if (video.channelId === 'taniguchi' && video.topic && whitespace(video.topic).length >= 2) {
    title = whitespace(video.topic);
  } else if (video.channelId === 'mundi') {
    title = title.replace(/^\d{3}\s*/, '')
      .replace(/\s*(?:世界史\s*[２2][０0]話プロジェクト|日本史ストーリーノート)\s*第[０-９0-9]+話.*$/u, '')
      .replace(/[（(]教科書\s*\d+[）)]/g, '');
  } else if (video.channelId === 'chowakaru') {
    const banner = title.search(subjectTag);
    if (banner > 0) title = title.slice(0, banner);
    else title = title.replace(subjectTag, '');
    title = title.replace(/(?:[〜～~]\s*)?(?:授業|演習)[〜～~]\s*/g, '')
      .replace(/(?:[〜～~]\s*)?(?:超わかる[！!]?高校(?:数学|化学|英語)[^#＃]*)$/g, '')
      .replace(/\s*(?:展開・因数分解|反応速度|酸と塩基|数列|積分法|微分法)\s*[#＃]\s*[０-９0-9]+\s*$/g, '');
  } else if (video.channelId === 'tadayobi') {
    title = title.replace(/【第\s*\d+\s*講】/g, ' ')
      .replace(/【(?:現代文[^】]*講座|漢文基礎講座[^】]*|解釈講座[^】]*)】/g, '')
      .replace(/(?:【|［)(?:物理基礎|物理|現代文|漢文|古文)(?:】|］)/g, '');
  }

  title = title.replace(promoTag, '')
    .replace(subjectTag, '')
    .replace(/^\[数[ⅠⅡⅢABCI1-3]\]\s*/g, '')
    .replace(/^\[統計\s*#\d+\]\s*/g, '')
    .replace(/\s*\[統計的な推測\]\s*$/g, '')
    .replace(/\s*【第\s*\d+\s*講】\s*/g, ' ')
    .replace(/[〜～~]\s*超わかる[！!]?\s*高校(?:数学|化学|英語).*$/g, '')
    .replace(/\s*世界史\s*[２2][０0]話プロジェクト\s*第[０-９0-9]+話.*$/g, '')
    .replace(/\s*日本史ストーリーノート\s*第[０-９0-9]+話.*$/g, '')
    .replace(/\s*[/／]\s*全\s*\d+\s*講/g, '')
    .replace(/\s*[#＃]\s*[０-９0-9]+\s*$/, '')
    .replace(/^[\s｜|│・：:〜～~-]+|[\s｜|│・：:〜～~-]+$/g, '');

  title = whitespace(title) || original;
  const details = [kind, number ? '#' + number : ''].filter(Boolean);
  return { title, detail: details.join(' · ') };
}
