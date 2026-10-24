"""Build exact logo derivatives from the approved source. Requires Pillow; not part of CI."""
from PIL import Image
from pathlib import Path
import math
root=Path(__file__).resolve().parents[1]
source=Image.open(root/'public/brand/curiveo-original.png').convert('RGB')
symbol=source.crop((493,173,1033,741))
wordmark=source.crop((308,767,1230,990))
symbol.save(root/'public/brand/symbol.webp',quality=95)
wordmark.save(root/'public/brand/wordmark.webp',quality=95)
# All non-white coloured artwork remains inside the Android safe circle.
pixels=symbol.load(); cx,cy=symbol.width/2,symbol.height/2
radius=max(math.hypot(x-cx,y-cy) for y in range(symbol.height) for x in range(symbol.width) if min(pixels[x,y])<180)
for size in [16,32,180,192,512]:
 for maskable in ([False,True] if size in [192,512] else [False]):
  scale=(size*.388/radius) if maskable else size*.86/max(symbol.size)
  art=symbol.resize((round(symbol.width*scale),round(symbol.height*scale)),Image.Resampling.LANCZOS)
  icon=Image.new('RGB',(size,size),'white'); icon.paste(art,((size-art.width)//2,(size-art.height)//2))
  name=f'icon-maskable-{size}.png' if maskable else (f'favicon-{size}.png' if size<40 else f'icon-{size}.png')
  icon.save(root/'public'/name,optimize=True)
print('Brand assets: exact symbol and wordmark, normal and separate maskable icons generated.')
