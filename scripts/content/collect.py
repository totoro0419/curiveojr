#!/usr/bin/env python3
"""Read public source indexes. Network collection is explicit; no catalog mutation.
Requires beautifulsoup4. Cache is scratch; extracted evidence is committed separately.
"""
import concurrent.futures as cf, hashlib, json, re, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[2]
CACHE=Path('/tmp/curiveojr-content-cache');CACHE.mkdir(exist_ok=True)
OUT=ROOT/'data/content';OUT.mkdir(exist_ok=True)
STAMP='2026-10-24'
def get(url, payload=None):
 key=hashlib.sha256((url+json.dumps(payload,sort_keys=True)).encode()).hexdigest();p=CACHE/key
 if p.exists():return p.read_text()
 for n in range(3):
  try:
   req=urllib.request.Request(url,data=json.dumps(payload).encode() if payload else None,headers={'User-Agent':'Mozilla/5.0','Content-Type':'application/json','Accept-Language':'ja'})
   text=urllib.request.urlopen(req,timeout=40).read().decode();p.write_text(text);return text
  except urllib.error.HTTPError as error:
   if error.code==429 or n==2:raise
  except Exception:
   if n==2:raise
 return ''
def walk(x,key):
 if isinstance(x,dict):
  if key in x:yield x[key]
  for y in x.values():yield from walk(y,key)
 elif isinstance(x,list):
  for y in x:yield from walk(y,key)
def txt(x):return x.get('simpleText') or x.get('content') or ''.join(a.get('text','') for a in x.get('runs',[]))
def initial(s):return json.loads(re.search(r'(?:var ytInitialData = |ytInitialData\s*=\s*)(.*?);</script>',s).group(1))
def context(s):return json.loads(re.search(r'"INNERTUBE_CONTEXT":(.*?),"INNERTUBE_CONTEXT_CLIENT_NAME"',s).group(1))
def pages(url):
 s=get(url);d=initial(s);ctx=context(s);page=d.get('contents',d)
 if '/playlist?' in url:page=next(walk(page,'itemSectionRenderer'))['contents']
 seen=set()
 for _ in range(30):
  yield page
  tokens=[x for x in walk(page,'continuationCommand') if 'token' in x]
  if not tokens:return
  t=tokens[0]['token']
  if t in seen:raise ValueError('repeated continuation')
  seen.add(t)
  r=json.loads(get('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',{'context':ctx,'continuation':t}))
  page=r.get('onResponseReceivedActions') or r.get('onResponseReceivedEndpoints')
  if not page:raise ValueError('continuation did not return list')
def playlists(url):
 out=[]
 for p in pages(url):
  for x in walk(p,'lockupViewModel'):
   if x.get('contentType') in ['LOCKUP_CONTENT_TYPE_PLAYLIST','LOCKUP_CONTENT_TYPE_COURSE']:out.append({'id':x['contentId'],'title':txt(x['metadata']['lockupMetadataViewModel']['title'])})
  for x in walk(p,'playlistRenderer'):out.append({'id':x['playlistId'],'title':txt(x['title'])})
 return list({x['id']:x for x in out}.values())
def playlist(spec):
 pid=spec['id'];url='https://www.youtube.com/playlist?list='+pid;items=[];error=None
 try:
  for p in pages(url):
   for x in walk(p,'lockupViewModel'):
    if x.get('contentType')!='LOCKUP_CONTENT_TYPE_VIDEO':continue
    m=x['metadata']['lockupMetadataViewModel'];authors=list(walk(m,'browseEndpoint'));labels=[txt(a) for a in walk(m.get('metadata',{}),'text')];dur=[a.get('text') for a in walk(x.get('contentImage',{}),'thumbnailBadgeViewModel')];seconds=None
    for v in dur:
     if v and re.fullmatch(r'\d+(?::\d+){1,2}',v):
      seconds=0
      for n in v.split(':'):seconds=seconds*60+int(n)
      break
    items.append({'id':x['contentId'],'title':txt(m['title']),'uploader':(re.search(r'チャンネル「(.*?)」',m.get('image',{}).get('decoratedAvatarViewModel',{}).get('a11yLabel','')).group(1) if re.search(r'チャンネル「(.*?)」',m.get('image',{}).get('decoratedAvatarViewModel',{}).get('a11yLabel','')) else (labels[0] if labels else None)),'channelId':authors[0].get('browseId') if authors else None,'durationSeconds':seconds,'restricted':any(re.search(r'Members.only|メンバー限定|会員限定',str(b),re.I) for b in walk(m,'badgeViewModel'))})
   for x in walk(p,'playlistVideoRenderer'):
    a=x.get('shortBylineText',{});author=list(walk(a,'browseEndpoint'));v=txt(x.get('lengthText',{}));seconds=None
    if re.fullmatch(r'\d+(?::\d+){1,2}',v):
     seconds=0
     for n in v.split(':'):seconds=seconds*60+int(n)
    items.append({'id':x['videoId'],'title':txt(x['title']),'uploader':txt(a),'channelId':author[0].get('browseId') if author else None,'durationSeconds':seconds})
 except Exception as e:error=str(e)
 result={**spec,'url':url,'checkedAt':STAMP,'items':items,'collectionError':error,'completeListing':error is None}
 (OUT/('playlist-'+pid+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print('playlist',spec['channel'],spec['title'],len(items),error,flush=True);return result

def discover():
 channels={'sakurara':'https://www.youtube.com/@sakurara/playlists','keitaku':'https://www.youtube.com/channel/UC3LgVYRHHKxo0RkziCsgp6g/playlists','kobachan':'https://www.youtube.com/channel/UCVxg1EE8Efu6M2WyYg6zYPA/playlists'}
 out=[]
 for ch,u in channels.items():
  try:
   p=playlists(u);out += [{**x,'channel':ch} for x in p];print(ch,len(p),flush=True)
  except Exception as e:print(ch,'ERROR',e,flush=True)
 (OUT/'discovered-playlists.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')

def indexes():
 out=[]
 url='https://kyoiku.info/quick-learning/';s=BeautifulSoup(get(url),'html.parser');section=group=sub=''
 for tag in s.select('h2,h3,h4,a[href]'):
  t=tag.get_text(' ',strip=True)
  if tag.name=='h2':section=t;group=sub=''
  elif tag.name=='h3':group=t;sub=''
  elif tag.name=='h4':sub=t
  elif ('算数講座' in section or '理科講座' in section.replace('　','')) and group!='テキスト購入':
   u=tag['href'];m=re.search(r'(?:youtu.be/|[?&]v=)([\w-]{11})',u)
   if m:out.append({'id':m[1],'sourceTitle':t,'channel':'quick','subject':'mathematics' if '算数' in section else 'chemistry','field':group,'unit':sub or group,'sourceUrl':url,'order':len(out)+1})
 # Official subject pages, preserving heading/table row order.
 u='https://sansu.online/'+urllib.parse.quote('講義動画一覧')+'/'
 main=BeautifulSoup(get(u),'html.parser')
 links={a.get_text(strip=True):a['href'] for a in main.select('a[href]') if a.get_text(strip=True) in ['数と計算','規則性','数の性質','文章題','比・割合','平面図形','速さ','立体図形','場合の数']}
 def page(kv):
  field,url=kv;sp=BeautifulSoup(get(url),'html.parser');unit=field;arr=[]
  body=sp.select_one('.entry-body') or sp.select_one('article') or sp
  for tag in body.select('h1,h2,h3,tr'):
   if tag.name!='tr':
    t=tag.get_text(' ',strip=True)
    if t and t not in ['Youtubeチャンネル','「理数館の算数の人」']:unit=t
   else:
    for a in tag.select('a[href]'):
     m=re.search(r'(?:youtu.be/|[?&]v=)([\w-]{11})',a['href'])
     if m:arr.append({'id':m[1],'sourceTitle':a.get_text(' ',strip=True).lstrip('▶ '),'channel':'risukan','subject':'mathematics','field':field,'unit':unit,'sourceUrl':url,'order':len(arr)+1,'rowText':tag.get_text(' ',strip=True)})
  print('index',field,len(arr),flush=True);return arr
 with cf.ThreadPoolExecutor(max_workers=6) as pool:
  for arr in pool.map(page,links.items()):out.extend(arr)
 (OUT/'official-indexes.json').write_text(json.dumps({'checkedAt':STAMP,'items':out},ensure_ascii=False,indent=2)+'\n');print('indexes total',len(out),flush=True)
if __name__=='__main__':
 import sys
 if 'discover' in sys.argv:discover()
 if 'indexes' in sys.argv:indexes()
 if 'playlists' in sys.argv:
  specs=json.loads((OUT/'selected-playlists.json').read_text())
  with cf.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(playlist,specs))
