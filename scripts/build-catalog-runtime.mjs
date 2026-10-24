import {readFileSync,writeFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
const index=key=>new Map(c[key].map((row,i)=>[row.id,i]));
const ch=index('channels'),su=index('subjects'),un=index('units'),se=index('series');
const runtime={
 schemaVersion:1,updatedAt:c.updatedAt,mathveoSourceCommit:c.mathveoSourceCommit,
 subjects:c.subjects,channels:c.channels,
 units:c.units.map(({evidence,...unit})=>unit),
 series:c.series.map(s=>({...s,lessons:s.lessons?.map(x=>[s.videoIds.indexOf(x.videoId),x.sourceOrder,un.get(x.unitId)])})),
 videos:c.videos.map(v=>[v.id,v.title,ch.get(v.channelId),su.get(v.subjectId),v.level,v.unitIds.map(id=>un.get(id)),v.seriesIds.map(id=>se.get(id)),v.order,v.role,v.durationSeconds,Boolean(['youtube-public-playlist','youtube-watch-page'].includes(v.durationEvidence?.method||'')&&v.durationSeconds),v.notice||null]),
 routes:c.routes,gaps:c.gaps,coverage:c.coverage,legacySeriesRedirects:c.legacySeriesRedirects,
};
writeFileSync('src/data/catalog-runtime.json',JSON.stringify(runtime)+'\n');
console.log(`Runtime catalog: ${Buffer.byteLength(JSON.stringify(runtime))} bytes; source evidence retained in catalog.json`);
