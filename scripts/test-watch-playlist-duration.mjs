import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from './load-typescript.mjs';

const { watchPlaylistPage, WATCH_PLAYLIST_PAGE_SIZE } = await loadTs('src/lib/watch-playlist-page.ts');
const { totalDuration } = await loadTs('src/lib/duration.ts');
assert.equal(WATCH_PLAYLIST_PAGE_SIZE, 30);

const videos = Array.from({ length: 67 }, (_, n) => ({ id: `lesson-${n}`, durationSeconds: 60 + n }));
const expectedRanges = [[0, 30], [30, 60], [60, 67]];
for (const [pageNumber, [start, end]] of expectedRanges.entries()) {
  const page = watchPlaylistPage(videos, pageNumber);
  assert.equal(page.page, pageNumber);
  assert.equal(page.start, start);
  assert.equal(page.end, end);
  assert.deepEqual(page.entries, videos.slice(start, end));
  const expectedSeconds = videos.slice(start, end).reduce((sum, video) => sum + video.durationSeconds, 0);
  assert.equal(totalDuration(page.entries).seconds, expectedSeconds);
  if (pageNumber === 0) assert.notEqual(totalDuration(page.entries).seconds, totalDuration(videos).seconds);
}
assert.deepEqual(watchPlaylistPage(videos, 999).entries, videos.slice(60));
assert.deepEqual(watchPlaylistPage(videos, -4).entries, videos.slice(0, 30));
assert.deepEqual(watchPlaylistPage(videos, NaN).entries, videos.slice(0, 30));
assert.deepEqual(watchPlaylistPage([], 7).entries, []);
assert.equal(watchPlaylistPage(videos.slice(0, 12), 0).entries.length, 12);

// Guard against a regression where the sidebar rows are paged but the total uses the entire course.
const app = readFileSync('src/App.tsx', 'utf8');
assert.match(app, /const visiblePlaylist = watchPlaylistPage\(sequence, episodePage\)/);
assert.match(app, /const playlistVideos = visiblePlaylist\.entries\.map\(/);
assert.match(app, /durationSummary\(playlistVideos,\s*learning\.records\)/);
assert.match(app, /visiblePlaylist\.entries\.map\(\(videoId, offset\)/);
assert.doesNotMatch(app, /durationSummary\(sequence\.map\(/);
console.log('Watch playlist page and visible-duration regression: PASS');
