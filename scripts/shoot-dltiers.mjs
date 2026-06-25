import { chromium } from "playwright";
const b=await chromium.launch();
async function shot(login, name){
  const p=await (await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:3})).newPage();
  await p.goto(`http://localhost:4000/u/${login}`,{waitUntil:"networkidle"}).catch(()=>{});
  await p.waitForTimeout(2800);
  const share=p.getByRole("button",{name:/SHARE MY CARD/i}).first();
  const box=await share.boundingBox();
  if(box) await p.screenshot({path:`/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2/${name}.png`, clip:{x:box.x-20,y:box.y+150,width:box.width+40,height:120}});
  console.log("OK",name);
  await p.close();
}
await shot("kholt","D-gold");      // GOLD sample
await shot("torvalds","D-icon");   // ICON sample
await shot("mrivas","D-toty");     // TOTY sample
await b.close();
