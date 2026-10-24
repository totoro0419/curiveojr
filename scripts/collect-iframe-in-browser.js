/** Reusable cloud-browser collection procedure.
 * Run in cua_repl after binding a Curiveo tab. Supply the exact catalog queue.
 * Uses only the visible UI fed by the regular IFrame Player API. Does not play,
 * download media, parse YouTube pages, or access undocumented APIs.
 * Persist every onBatch JSON result before continuing; resume via startIndex.
 */
async function collectIframeDurations(tab, videoIds, startIndex, onBatch, count=20) {
 const rows=[];
 for(let index=startIndex;index<Math.min(startIndex+count,videoIds.length);index++){
  const id=videoIds[index];
  await tab.goto('https://totoro0419.github.io/curiveo/#/watch/'+id);
  await tab.getAXState({emit:false});
  await tab.playwright.locator('input[aria-label="再生位置"]:not([disabled])').waitFor({state:'visible',timeoutMs:15000});
  const sourceUrl=await tab.playwright.locator('iframe').getAttribute('src');
  const sourceVideoId=new URL(sourceUrl).pathname.split('/').pop();
  const durationSeconds=Number(await tab.playwright.getByRole('slider',{name:'再生位置',exact:true}).getAttribute('max'));
  if(sourceVideoId!==id||!Number.isSafeInteger(durationSeconds)||durationSeconds<=0)throw Error('ID/duration mismatch at '+index);
  rows.push({videoId:id,sourceVideoId,durationSeconds,sourceUrl,source:'youtube-iframe-player-api',verifiedAt:new Date().toISOString()});
 }
 await onBatch(rows);
 return startIndex+rows.length;
}
