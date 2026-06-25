import { chromium } from "playwright";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:3})).newPage();
await p.goto("http://localhost:4000/u/Mawsis",{waitUntil:"networkidle"}).catch(()=>{});
await p.waitForTimeout(2800);
const btn=p.getByRole("button",{name:/SHARE MY CARD/i}).first();
await btn.scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(300);
const box=await btn.boundingBox();
if(box){ await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/B1-btn-rest.png", clip:{x:box.x-20,y:box.y-12,width:box.width+40,height:box.height+24}});
  await btn.hover(); await p.waitForTimeout(350);
  await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/B2-btn-hover.png", clip:{x:box.x-20,y:box.y-12,width:box.width+40,height:box.height+24}}); }
console.log("done");
await b.close();
