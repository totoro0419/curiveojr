import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4173/curiveojr/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
server.stderr.on('data',chunk=>process.stderr.write(chunk));
const errors=[];
let browser;
async function waitForServer(){
 for(let i=0;i<60;i++){
  try{const response=await fetch(origin);if(response.ok)return;}catch{}
  await sleep(150);
 }
 throw Error('Preview server did not start');
}
const check=async(label,promise)=>{await promise;console.log('PASS '+label);};
try{
 await waitForServer();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(15000);
 await page.goto(origin+'#/subject/mathematics');
 await check('Subject bookmark button visible',page.getByRole('button',{name:'ホームにブックマーク'}).first().waitFor());
 await page.getByRole('button',{name:'ホームにブックマーク'}).first().click();
 await check('Subject bookmark saved',page.getByRole('button',{name:'ホームのブックマークから外す'}).first().waitFor());
 await page.goto(origin+'#/history/core');
 await check('History playlist bookmark visible',page.getByRole('button',{name:'ホームにブックマーク'}).first().waitFor());
 await page.getByRole('button',{name:'ホームにブックマーク'}).first().click();
 await page.goto(origin+'#/course/yt-PLdOJns3YfInOjm2LpyArpTSxA58btCpdH');
 await check('Course bookmark button visible',page.getByRole('button',{name:'ホームにブックマーク'}).first().waitFor());
 await page.getByRole('button',{name:'ホームにブックマーク'}).first().click();
 await page.goto(origin);
 const items=page.locator('.bookmarked-section .bookmark-item');
 await check('Three bookmarks on home',items.nth(2).waitFor());
 assert.equal(await items.count(),3);
 const links=await page.locator('.bookmarked-section .bookmark-link').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
 assert.ok(links.includes('#/subject/mathematics'));
 assert.ok(links.includes('#/history/core'));
 assert.ok(links.some(x=>x?.startsWith('#/course/')));
 await page.reload();
 await check('Bookmarks survive app reload',page.locator('.bookmarked-section .bookmark-item').nth(2).waitFor());
 assert.equal(await page.locator('.bookmarked-section .bookmark-item').count(),3);
 await page.locator('.bookmarked-section .bookmark-item').first().getByRole('button',{name:'ホームのブックマークから外す'}).click();
 assert.equal(await page.locator('.bookmarked-section .bookmark-item').count(),2);
 await page.reload();
 await check('Bookmark removal persisted',page.locator('.bookmarked-section .bookmark-item').nth(1).waitFor());
 assert.equal(await page.locator('.bookmarked-section .bookmark-item').count(),2);
 assert.deepEqual(errors,[],'No page errors');
 console.log('Bookmark navigation E2E PASS');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
