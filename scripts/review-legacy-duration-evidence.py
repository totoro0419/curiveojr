"""Review existing ID-bound evidence under the user's targeted-audit policy.
Never claim these records were independently remeasured. Prefer per-ID watch
metadata to a URL-less checkpoint for the previously identified one-second cases.
"""
import datetime as dt
import fcntl
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import urllib.parse
spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('collect-video-durations.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
lock=open(Path(tempfile.gettempdir())/('curiveo-durations-'+hashlib.sha256(str(c.REPO).encode()).hexdigest()[:12]+'.lock'),'w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
data=c.read('data/video-metadata/durations.json');checkpoint=c.read('data/video-metadata/duration-index-checkpoint-2026-10-13.json');review=[]
for vid,e in data['videos'].items():
 if e['status']=='verified':continue
 assert c.positive(e['durationSeconds'])
 legacy=next(x for x in e['legacyEvidence'] if x['location']=='legacy-metadata')
 assert legacy['seconds']==e['durationSeconds']
 method=legacy['method'];checked=legacy['checkedAt']
 if method=='public-watch-videoDetails':
  assert urllib.parse.parse_qs(urllib.parse.urlparse(legacy['sourceUrl']).query)['v']==[vid]
  identity='Exact ID in original watch URL and legacy videoDetails extraction contract.'
 elif method=='public-playlist-duration-label':
  assert urllib.parse.parse_qs(urllib.parse.urlparse(legacy['sourceUrl']).query).get('list')
  identity='Exact renderer videoId was the collector record key; playlist position/title was not used.'
 elif method=='validated-collector-index-checkpoint':
  assert checkpoint['videos'][vid]==e['durationSeconds']
  identity='Exact videoId key and identical seconds in the retained collector checkpoint.'
 else:raise ValueError('Unreviewed legacy method '+method)
 for conflict in e.get('conflicts',[]):
  assert method=='public-watch-videoDetails' and max(conflict['values'])-min(conflict['values'])==1
  e.setdefault('resolvedConflicts',[]).append({**conflict,'resolution':'Retain original ID-matched per-video metadata over URL-less historical checkpoint under targeted review; no new measurement claimed.','reviewedAt':c.now()})
  review.append({'videoId':vid,'adoptedSeconds':e['durationSeconds'],'otherSeconds':conflict['values'],'reason':'Source identity is stronger than historical checkpoint; one-second discrepancy is retained in evidence.'})
 e['conflicts']=[];e['status']='reviewed_legacy';e['sourceVideoId']=vid;e['verifiedAt']=None
 e['reviewedAt']=c.now();e['identityEvidence']=identity
 e['refreshBy']=(dt.datetime.fromisoformat(checked)+dt.timedelta(days=30)).isoformat()
 e['reviewPolicy']='User-approved targeted source/exception audit; not independent all-video remeasurement.'
c.atomic(c.REPO/'data/video-metadata/legacy-source-review.json',{'reviewedAt':c.now(),'conflicts':review})
print(c.save(data,c.read('src/data/catalog.json')))
