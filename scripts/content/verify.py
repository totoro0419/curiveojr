#!/usr/bin/env python3
"""Confirm canonical title and uploader from YouTube oEmbed. Fail closed."""
import concurrent.futures as cf,json,sys,urllib.parse
from pathlib import Path
from collect import get,OUT,STAMP
index=json.loads((OUT/'official-indexes.json').read_text())['items']
ids=list(dict.fromkeys(x['id'] for x in index));target=OUT/'video-metadata.json'
metadata=json.loads(target.read_text()) if target.exists() else {}
def one(vid):
 try:
  data=json.loads(get('https://www.youtube.com/oembed?url='+urllib.parse.quote('https://www.youtube.com/watch?v='+vid,safe='')+'&format=json'))
  return vid,{'title':data['title'],'uploaderName':data['author_name'],'authorUrl':data['author_url'],'thumbnailUrl':data.get('thumbnail_url'),'publicMetadata':'confirmed','embedMetadata':'allowed' if '<iframe' in data.get('html','') else 'unverified','checkedAt':STAMP}
 except Exception as e:return vid,{'error':str(e),'publicMetadata':'unverified','checkedAt':STAMP}
missing=[v for v in ids if metadata.get(v,{}).get('publicMetadata')!='confirmed'];print('checking',len(missing),flush=True)
with cf.ThreadPoolExecutor(max_workers=10) as pool:
 for i,(vid,result) in enumerate(pool.map(one,missing)):
  metadata[vid]=result
  if i%25==0:
   target.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n');print(i+1,'/',len(missing),flush=True)
target.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n');print('confirmed',sum(x.get('publicMetadata')=='confirmed' for x in metadata.values()),'total',len(metadata),flush=True)
