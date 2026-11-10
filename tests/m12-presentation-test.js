/* M12: guard the pixel-art presentation and local sprite references. */
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(process.argv[2]||".");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"js/app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"css/main.css"),"utf8");
const sprites=["contestant-blue.svg","chaser-red.svg","team-duo.svg"];
for(const file of sprites){
  const p=path.join(root,"assets","sprites",file);
  if(!fs.existsSync(p))throw new Error("Missing pixel sprite: "+file);
  const svg=fs.readFileSync(p,"utf8");
  if(!svg.includes("<svg")||!svg.includes("shape-rendering=\"crispEdges\""))throw new Error("Sprite is not a crisp-edged SVG: "+file);
}
for(const marker of ["chase-broadcast-call","final-broadcast-banner","final-broadcast-call"])
  if(!html.includes('id="'+marker+'"'))throw new Error("Missing broadcast UI element: "+marker);
for(const marker of ["contestant-blue.svg","chaser-red.svg","team-duo.svg","function renderFinalRace","currentMatch.headToHead?currentMatch.headToHead.playerIndex:currentMatch.activePlayerIndex"])
  if(!app.includes(marker))throw new Error("Missing character integration: "+marker);
for(const marker of ["@keyframes contestant-idle","@keyframes chaser-stalk","@keyframes chaser-board-lunge","@media(prefers-reduced-motion:reduce)"])
  if(!css.includes(marker))throw new Error("Missing animation/accessibility rule: "+marker);
console.log("M12 presentation passed: all local pixel sprites, board integration, broadcast elements and reduced-motion rules present.");
