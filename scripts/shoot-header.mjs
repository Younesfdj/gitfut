import { chromium } from "playwright";
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});
const p=await ctx.newPage();
// public route renders ResultView server-side with live data; no live overlay form to fight
await p.goto("http://localhost:4000/u/Mawsis",{waitUntil:"networkidle"}).catch(e=>console.log("nav",e.message));
await p.waitForTimeout(1400); // mid-cascade
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/H1-header-mid.png"});
await p.waitForTimeout(3500); // settled + shimmer done
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/H2-header-settled.png"});
console.log("done");
await b.close();
