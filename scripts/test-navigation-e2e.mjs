import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const ORIGIN='http://127.0.0.1:4173/curiveojr/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
server.stdout.on('data',chunk=>process.stdout.write(String(chunk)));
server.stderr.on('data',chunk=>process.stderr.write(String(chunk)));
let browser;
const checks=[];
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label);};
async function waitForServer(){
 for(let i=0;i<50;i++){
  try{const res=await fetch(ORIGIN);if(res.ok)return;}catch{}
  await delay(200);
 }
 throw Error('Preview server unavailable');
}
const waitRoute=async(page,pattern)=>page.waitForURL(url=>pattern.test(url.hash),{timeout:15000});
const noMissing=async page=>check(await page.getByText('分類が見つかりません。').count()===0,'No missing-category dead end');
const noErrors=[];
try{
 await waitForServer();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
 page.setDefaultTimeout(10000);
 page.setDefaultNavigationTimeout(12000);
 page.on('pageerror',error=>noErrors.push(error.message));
 await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
 await page.locator('a.subject-tile').first().waitFor({timeout:20000});
 check(await page.locator('a.subject-tile').count()===4,'Four subjects visible on mobile home');

 for(const [id,label] of [['mathematics','算数'],['japanese','国語'],['chemistry','理科'],['japanese-history','社会']]){
  await page.goto(ORIGIN+'#/subject/'+id,{waitUntil:'domcontentloaded'});
  await page.locator('main h1').getByText(label,{exact:true}).waitFor({timeout:15000});
  await noMissing(page);
  await page.getByRole('tab',{name:'チャンネル・講座'}).click();
  await page.locator('.course-groups .disclosure-trigger').first().waitFor({timeout:15000});
  let first=page.locator('.course-groups .disclosure').first();
  let trigger=first.locator('.disclosure-trigger').first();
  if((await trigger.getAttribute('aria-expanded'))==='false')await trigger.click();
  const link=first.locator('a.course-row').first();
  await link.waitFor({timeout:15000});
  const href=await link.getAttribute('href');
  check(Boolean(href?.startsWith('#/course/')),label+' channel → course link present');
  await link.click();
  await waitRoute(page,/^#\/course\//);
  await page.getByText('講座の目次',{exact:true}).waitFor({timeout:15000});
  const start=page.locator('a.course-start').first();
  await start.waitFor({timeout:15000});
  check(Boolean((await start.getAttribute('href'))?.startsWith('#/watch/')),label+' course → lesson link present');
  await start.click();
  await waitRoute(page,/^#\/watch\//);
  await page.locator('main .watch-main, main .watch-layout, main .player-frame').first().waitFor({timeout:15000}).catch(async()=>{await page.locator('a.back-link').waitFor()});
  await noMissing(page);
  check(page.url().includes('#/watch/'),label+' opened lesson');
 }
 await page.goto(ORIGIN+'#/discover',{waitUntil:'domcontentloaded'});
 await page.getByRole('tab',{name:'教科'}).click().catch(()=>{});
 await page.locator('a.subject-tile').first().click();
 await waitRoute(page,/^#\/subject\//);
 check(!page.url().includes('undefined'),'Discover → subject route');
 await page.getByRole('tab',{name:'分野・単元から探す'}).click();
 const category=page.locator('.hierarchy-card a, a.hierarchy-card').first();
 await category.waitFor({timeout:15000});
 const categoryHref=await category.getAttribute('href');
 check(Boolean(categoryHref?.includes('%')),'Category link escaped');
 await category.click();
 await waitRoute(page,/^#\/category\//);
 await noMissing(page);
 check(await page.locator('main .hierarchy-grid, main .course-choices, main .selected-course').count()>0,'Subject → category route');
 console.log('E2E HIST: open social');
 await page.goto(ORIGIN+'#/subject/japanese-history',{waitUntil:'domcontentloaded'});
 console.log('E2E HIST: open history index');
 await page.locator('a[href="#/history"]').first().click();
 await waitRoute(page,/^#\/history$/);
 console.log('E2E HIST: open history core');
 await page.locator('a[href="#/history/core"]').first().click();
 await waitRoute(page,/^#\/history\/core$/);
 await page.locator('a[href^="#/history/era/"]').first().waitFor({timeout:15000});
 check(await page.locator('a[href^="#/history/era/"]').count()===11,'History: eleven named eras');
 console.log('E2E HIST: open ancient era');
 await page.locator('a[href="#/history/era/ancient"]').click();
 await waitRoute(page,/^#\/history\/era\/ancient$/);
 await page.locator('.video-row').first().waitFor({timeout:15000});
 check(await page.locator('.video-row').count()===3,'History: three foundational ancient lessons, no unrelated videos');
 console.log('E2E HIST: open first history lesson');
 await page.locator('.video-row').first().click();
 await waitRoute(page,/^#\/watch\//);
 check(true,'History: subject → all lessons → era → video');
 await page.goto(ORIGIN+'#/category/learn-mathematics-legacy',{waitUntil:'domcontentloaded'});
 await waitRoute(page,/^#\/subject\/mathematics/);
 await noMissing(page);
 check(true,'Legacy category recovery');
 check(noErrors.length===0,'No uncaught JavaScript exceptions: '+noErrors.join(' | '));
 console.log('NAVIGATION E2E PASS '+checks.length+' checks');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
