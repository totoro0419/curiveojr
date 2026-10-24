"""Collect ID-matched durations via documented YouTube Data API; never scrape.

Default: migrate legacy evidence and generate a reproducible audit without network.
--network: requires server-only YOUTUBE_API_KEY; batches at most 50 IDs.
--require-complete: exit nonzero unless every catalog ID is accepted by the agreed source-review policy.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request

REPO = Path(__file__).resolve().parent.parent
API = 'https://www.googleapis.com/youtube/v3/videos'
POLICY = 'https://developers.google.com/youtube/terms/developer-policies'

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', dir=path.parent, delete=False) as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.write('\n')
        out.flush()
        os.fsync(out.fileno())
        name = out.name
    os.replace(name, path)

def read(path):
    return json.loads((REPO / path).read_text())

def seconds(text):
    # Reject fractions/months/years, missing units and zero-length live placeholders.
    match = re.fullmatch(r'P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?', text)
    if not match or not any(match.groups()):
        raise ValueError('unsupported-iso-duration')
    value = sum(int(n or 0) * scale for n, scale in zip(match.groups(), [86400, 3600, 60, 1]))
    if value <= 0 or value > 9007199254740991:
        raise ValueError('nonpositive-duration')
    return value

def positive(value):
    return type(value) is int and 0 < value <= 9007199254740991

def migrate(catalog, old, index, supplement, checkpoint):
    entries = {}
    for video in catalog['videos']:
        vid = video['id']
        previous = old['videos'].get(vid, {})
        if previous.get('videoId') == vid:
            entries[vid] = previous
            continue
        evidence = []
        for path, value in [('src/data/video-durations.json', index.get(vid)),
                            ('src/data/history-duration-supplement.json', supplement.get(vid)),
                            ('catalog.durationSeconds', video.get('durationSeconds')),
                            ('data/video-metadata/duration-index-checkpoint-2026-10-13.json', checkpoint['videos'].get(vid))]:
            if value is not None:
                evidence.append({'location': path, 'durationSeconds': value})
        if previous:
            evidence.append({'location': 'legacy-metadata', **previous})
        values = {e.get('durationSeconds', e.get('seconds')) for e in evidence}
        valid = [e['durationSeconds'] for e in evidence if positive(e.get('durationSeconds'))]
        source_url = previous.get('sourceUrl')
        matched = urllib.parse.parse_qs(urllib.parse.urlparse(source_url or '').query).get('v', [None])[0]
        entry = {'videoId': vid, 'durationSeconds': valid[0] if valid else None,
                 'source': previous.get('method', 'legacy-title-only-supplement' if vid in supplement else 'none'),
                 'sourceUrl': source_url, 'sourceVideoId': matched,
                 'verifiedAt': None, 'status': 'legacy_unverified' if valid else 'missing',
                 'legacyEvidence': evidence, 'conflicts': []}
        if len(values) > 1:
            entry['status'] = 'conflict'
            entry['conflicts'].append({'reason': 'legacy-values-disagree', 'values': sorted(values)})
        if vid in supplement:
            entry['verificationIssue'] = 'Same-title Bilibili mirror: original YouTube ID/duration not verified.'
        entries[vid] = entry
    return {'schemaVersion': 2, 'videos': entries, 'previousFailures': old.get('unavailable', {})}

def apply_response(requested, response, entries, checked):
    items = response.get('items')
    if not isinstance(items, list):
        raise ValueError('invalid-api-response')
    returned = [item.get('id') for item in items]
    if len(returned) != len(set(returned)) or not set(returned) <= set(requested):
        raise ValueError('response-id-mismatch')
    for vid in requested:
        entry = entries[vid]
        entry['lastAttemptAt'] = checked
        item = next((item for item in items if item['id'] == vid), None)
        if item is None:
            entry['status'] = 'unavailable_unspecified'
            entry['lastAttemptStatus'] = 'unavailable_unspecified'
            entry['failureReason'] = 'API omitted ID; private/deleted/not-found cannot be distinguished.'
            continue
        if item.get('snippet', {}).get('liveBroadcastContent') in ('live', 'upcoming'):
            entry['status'] = 'live_not_final'
            entry['lastAttemptStatus'] = 'live_not_final'
            continue
        try:
            value = seconds(item['contentDetails']['duration'])
        except (KeyError, ValueError):
            entry['status'] = 'duration_unavailable'
            entry['lastAttemptStatus'] = 'duration_unavailable'
            continue
        candidate = {'videoId': vid, 'durationSeconds': value, 'source': 'youtube-data-api-v3',
                     'sourceUrl': 'https://www.youtube.com/watch?v=' + vid,
                     'sourceVideoId': item['id'], 'verifiedAt': checked,
                     'refreshBy': (dt.datetime.fromisoformat(checked) + dt.timedelta(days=30)).isoformat(),
                     'status': 'verified', 'isoDuration': item['contentDetails']['duration'],
                     'embeddable': item.get('status', {}).get('embeddable')}
        prior = entry.get('durationSeconds')
        if prior is not None and prior != value:
            conflict = {'reason': 'official-value-differs', 'previousSeconds': prior, 'candidate': candidate}
            if conflict not in entry.setdefault('conflicts', []):
                entry['conflicts'].append(conflict)
            entry['status'] = 'conflict'
            entry['lastAttemptStatus'] = 'review_required'
        else:
            entry.update(candidate)
            entry['lastAttemptStatus'] = 'verified'
            entry.pop('failureReason', None)

def fresh(entry):
    try:
        return entry.get('status') == 'verified' and dt.datetime.fromisoformat(entry['refreshBy']) > dt.datetime.now(dt.timezone.utc)
    except (KeyError, ValueError):
        return False

def accepted(entry):
    try:
        return entry.get('status') in ('verified', 'reviewed_legacy') and dt.datetime.fromisoformat(entry['refreshBy']) > dt.datetime.now(dt.timezone.utc)
    except (KeyError, ValueError):
        return False

def save(data, catalog):
    entries = data['videos']
    atomic(REPO / 'data/video-metadata/durations.json', data)
    # Keep original evidence, including unresolved supplement values, without calling it verified.
    index = {vid: e['durationSeconds'] for vid, e in sorted(entries.items()) if positive(e.get('durationSeconds'))}
    atomic(REPO / 'src/data/video-durations.json', index)
    atomic(REPO / 'src/data/duration-status.json', {vid: ('verified@' if fresh(e) else 'accepted@') + e['refreshBy'] if accepted(e) else e['status'] if e['status'] not in ('verified','reviewed_legacy') else 'stale' for vid, e in sorted(entries.items())})
    units = {u['id']: u for u in catalog['units']}
    series = {s['id']: s for s in catalog['series']}
    rows = [{**{k: e.get(k) for k in ['videoId', 'durationSeconds', 'source', 'sourceUrl', 'sourceVideoId', 'verifiedAt', 'reviewedAt', 'refreshBy', 'status', 'lastAttemptStatus', 'failureReason', 'verificationIssue']}, 'metadataRef': 'durations.json#/videos/' + e['videoId'], 'title': v['title'], 'subjects': v.get('subjectIds', [v['subjectId']]),
             'units': [{'id': uid, 'name': units[uid]['name']} for uid in v['unitIds']],
             'series': [{'id': sid, 'title': series[sid]['title']} for sid in v['seriesIds']]}
            for v in catalog['videos'] for e in [entries[v['id']]]]
    subjects = []
    for s in catalog['subjects']:
        members = [r for r in rows if s['id'] in r['subjects']]
        subjects.append({'id': s['id'], 'name': s['name'], 'total': len(members),
                         'recorded': sum(positive(r['durationSeconds']) for r in members),
                         'verified': sum(fresh(r) for r in members), 'accepted': sum(accepted(r) for r in members)})
    summary = {'total': len(rows), 'recorded': len(index), 'verified': sum(fresh(e) for e in entries.values()),
               'accepted': sum(accepted(e) for e in entries.values()), 'missing': len(rows) - len(index), 'conflicts': sum(e['status'] == 'conflict' for e in entries.values()),
               'subjects': subjects}
    atomic(REPO / 'data/video-metadata/duration-audit.json', {'summary': summary, 'videos': rows})
    return summary

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--network', action='store_true')
    parser.add_argument('--require-complete', action='store_true')
    args = parser.parse_args()
    lock = open(Path(tempfile.gettempdir()) / ('curiveo-durations-' + hashlib.sha256(str(REPO).encode()).hexdigest()[:12] + '.lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit('Another duration collector is already running.')
    catalog = read('src/data/catalog.json')
    data = migrate(catalog, read('data/video-metadata/durations.json'), read('src/data/video-durations.json'),
                   read('src/data/history-duration-supplement.json'), read('data/video-metadata/duration-index-checkpoint-2026-10-13.json'))
    if args.network:
        key = os.environ.get('YOUTUBE_API_KEY')
        if not key:
            data['collectionBlocker'] = 'YOUTUBE_API_KEY is not configured; no network requests sent.'
            print(json.dumps(save(data, catalog), ensure_ascii=False))
            raise SystemExit(data['collectionBlocker'])
        priority = {'japanese-history': 0, 'world-history': 1}
        queue = sorted((v for v in catalog['videos'] if not fresh(data['videos'][v['id']])), key=lambda v: priority.get(v['subjectId'], 2))
        for start in range(0, len(queue), 50):
            requested = [v['id'] for v in queue[start:start + 50]]
            query = urllib.parse.urlencode({'part': 'contentDetails,snippet,status', 'id': ','.join(requested), 'key': key})
            checked = now()
            try:
                with urllib.request.urlopen(API + '?' + query, timeout=30) as response:
                    apply_response(requested, json.load(response), data['videos'], checked)
            except (urllib.error.URLError, ValueError, TimeoutError) as error:
                # Never print exception URL/body: either can disclose credentials.
                reason = 'HTTP ' + str(error.code) if isinstance(error, urllib.error.HTTPError) else type(error).__name__
                data['collectionBlocker'] = reason
                for vid in requested:
                    data['videos'][vid].update(lastAttemptAt=checked, lastAttemptStatus='request_failed', failureReason=reason)
                save(data, catalog)
                raise SystemExit('Collection stopped: ' + reason)
            save(data, catalog)
        data.pop('collectionBlocker', None)
    summary = save(data, catalog)
    print(json.dumps(summary, ensure_ascii=False))
    if args.require_complete and summary['accepted'] != summary['total']:
        raise SystemExit('INCOMPLETE: not every catalog ID has an accepted duration under the agreed source-review policy.')

if __name__ == '__main__':
    main()
