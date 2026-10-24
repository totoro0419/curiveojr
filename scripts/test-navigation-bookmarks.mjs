import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('src/lib/navigation-bookmarks.ts','utf8');
const home=readFileSync('src/App.tsx','utf8');
const hierarchy=readFileSync('src/pages/HierarchyPage.tsx','utf8');
const history=readFileSync('src/pages/HistoryStudyPage.tsx','utf8');
const ui=readFileSync('src/components/catalog-ui.tsx','utf8');
for(const key of ['subject','category','course','channel','unit','route','history'])
 assert.ok(code.includes("'"+key+"'"),key+' bookmark type must be defined');
assert.ok(code.includes('localStorage.setItem(STORAGE'),'Bookmark must persist');
assert.ok(code.includes("window.addEventListener('storage'"),'Cross-tab storage notifications');
assert.ok(code.includes('if(!entries.length)return null'),'Do not show empty home list');
assert.ok(home.includes('<HomeBookmarks/>'),'Home must show pinned entries');
assert.ok(hierarchy.includes('BookmarkToggle'),'Hierarchy bookmark entry points');
assert.ok(history.includes('BookmarkToggle'),'History bookmark entry points');
assert.ok(ui.includes('BookmarkToggle'),'Course listing must allow pinning');
assert.ok(code.includes("if(kind==='course')"),'Course resolution must be validated against current catalog');
console.log('Navigation bookmarks: source integration PASS');
