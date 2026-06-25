import { chromium } from "playwright";
import { mkdirSync } from "fs";
const BASE="http://localhost:4000";
const OUT="/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2";
mkdirSync(OUT,{recursive:true});
const b=await chromium.launch();
async function viaForm(name, login, vp){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto(BASE,{waitUntil:"networkidle"}).catch(()=>{});
  await p.waitForTimeout(800);
  await p.fill('input[aria-label="GitHub username"]', login);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000); // live fetch + walkout settle
  await p.screenshot({path:`${OUT}/${name}.png`,fullPage:true});
  console.log("OK",name);
  await ctx.close();
}
await viaForm("L1-live-younes-desktop","Younesfdj",{width:1440,height:900});
await viaForm("L2-live-younes-mobile","Younesfdj",{width:390,height:844});
await viaForm("L3-live-antfu-desktop","antfu",{width:1440,height:900});
await b.close();
console.log("done");
