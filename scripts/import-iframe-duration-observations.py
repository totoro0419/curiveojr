"""Import executed, ID-matched IFrame Player UI observations, retaining old evidence.
The input queue must match its SHA256, and every batch has exact start/end bounds.
Only --apply-reviewed adopts values: use after independently checking player origin,
ID matching and each discrepancy against prior evidence. No network requests.
"""
import argparse
import datetime as dt
import hashlib
import fcntl
import tempfile
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('collect-video-durations.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def main():
 p=argparse.ArgumentParser();p.add_argument('--apply-reviewed',action='store_true');args=p.parse_args()
 queue=c.read('data/video-metadata/iframe-collection-queue.json')
 observations=c.read('data/video-metadata/iframe-observation-batches.json')
 ids=queue['videoIds'];assert len(ids)==len(set(ids))
 assert hashlib.sha256('\n'.join(ids).encode()).hexdigest()==queue['sha256']==observations['queueSha256']
 lock=open(Path(tempfile.gettempdir())/('curiveo-durations-'+hashlib.sha256(str(c.REPO).encode()).hexdigest()[:12]+'.lock'),'w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 catalog=c.read('src/data/catalog.json');assert set(ids)=={v['id'] for v in catalog['videos']}
 data=c.read('data/video-metadata/durations.json');seen=set();review=[]
 for batch in observations['batches']:
  assert batch['end']-batch['start']==len(batch['seconds'])
  for n,value in enumerate(batch['seconds'],batch['start']):
   vid=ids[n];assert vid not in seen;seen.add(vid)
   if value is None:continue
   assert c.positive(value)
   entry=data['videos'][vid]
   candidate={'videoId':vid,'sourceVideoId':vid,'durationSeconds':value,'source':'youtube-iframe-player-api',
     'sourceUrl':'https://www.youtube.com/embed/'+vid+'?enablejsapi=1&controls=0&playsinline=1&autoplay=0&start=0&origin=https%3A%2F%2Ftotoro0419.github.io&rel=0&hl=ja',
     'verifiedAt':batch['verifiedAt'],'refreshBy':(dt.datetime.fromisoformat(batch['verifiedAt'])+dt.timedelta(days=30)).isoformat(),
     'status':'verified','observationEvidence':{'file':'iframe-observation-batches.json','queueSha256':queue['sha256'],'index':n,
       'method':'Visible Curiveo seek-slider max, sourced from getDuration(); iframe source ID matched on every observation.'}}
   old=entry.get('durationSeconds')
   conflict=old is not None and old!=value
   if conflict:review.append({'videoId':vid,'previousSeconds':old,'currentPlayerSeconds':value})
   if not args.apply_reviewed:
    entry['iframeCandidate']=candidate
    continue
   if conflict and not any(x.get('source')=='iframe-review' and x.get('previousSeconds')==old and x.get('currentPlayerSeconds')==value for x in entry.get('resolvedConflicts',[])):
    entry.setdefault('resolvedConflicts',[]).append({'source':'iframe-review','previousSeconds':old,'currentPlayerSeconds':value,'reviewedAt':batch['verifiedAt'],
      'reason':'Current regular Player API on exact original ID; legacy page/checkpoint or title-only mirror is not current authority.'})
   if entry.get('conflicts'):
    entry.setdefault('resolvedConflicts',[]).extend({**x,'resolution':'Adopted current original-ID Player API duration','reviewedAt':batch['verifiedAt']} for x in entry['conflicts'])
    entry['conflicts']=[]
   entry.update(candidate);entry.pop('verificationIssue',None);entry.pop('iframeCandidate',None)
 c.atomic(c.REPO/'data/video-metadata/iframe-value-review.json',{'reviewed':args.apply_reviewed,'differences':review})
 data.pop('collectionBlocker',None)
 print(json.dumps(c.save(data,catalog),ensure_ascii=False))

if __name__=='__main__':main()
