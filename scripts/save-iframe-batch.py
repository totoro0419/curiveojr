"""Save an actually executed browser observation batch from stdin, validating bounds."""
import json
from pathlib import Path
import sys
p=Path(__file__).resolve().parent.parent/'data/video-metadata/iframe-observation-batches.json'
d=json.loads(p.read_text());b=json.load(sys.stdin)
assert b['end']-b['start']==len(b['seconds'])
assert b['start']==d['batches'][-1]['end']
assert all(v is None or type(v) is int and v>0 for v in b['seconds'])
d['batches'].append(b);tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(d,indent=2)+'\n');tmp.replace(p)
print('Saved observations through',b['end'])
