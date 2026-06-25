import { chromium } from "playwright";
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
const p=await ctx.newPage();
await p.goto("http://localhost:4000",{waitUntil:"networkidle"}).catch(()=>{});
await p.waitForTimeout(800);
await p.fill('input[aria-label="GitHub username"]','antfu');
await p.click('button[type="submit"]');
// capture mid-animation (bars sweeping)
await p.waitForTimeout(2600);
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/A1-metrics-mid.png",fullPage:true});
// capture settled
await p.waitForTimeout(2500);
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/A2-metrics-settled.png",fullPage:true});
console.log("done");
await b.close();
