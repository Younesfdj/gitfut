import { chromium } from "playwright";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:3})).newPage();
await p.goto("http://localhost:4000/u/Mawsis",{waitUntil:"networkidle"}).catch(()=>{});
await p.waitForTimeout(3000);
// find share button to anchor the crop
const share=p.getByRole("button",{name:/SHARE MY CARD/i}).first();
const box=await share.boundingBox();
const y = box ? box.y - 10 : 600;
// resting
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/S1-share-rest.png", clip:{x:(box?box.x-30:480),y,width:(box?box.width+60:380),height:180}});
// hover LinkedIn to show brand blue
const li=p.getByRole("button",{name:/Share on LinkedIn/i}).first();
await li.hover().catch(()=>{});
await p.waitForTimeout(350);
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/S2-share-hover.png", clip:{x:(box?box.x-30:480),y,width:(box?box.width+60:380),height:180}});
console.log("done");
await b.close();
