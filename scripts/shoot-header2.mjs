import { chromium } from "playwright";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2})).newPage();
await p.goto("http://localhost:4000/u/Mawsis",{waitUntil:"networkidle"}).catch(()=>{});
await p.waitForTimeout(2200); // after underline + cascade, during shimmer
await p.screenshot({path:"/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/H3-header-amped.png"});
console.log("done");
await b.close();
