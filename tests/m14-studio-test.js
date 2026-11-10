/* M14: validate studio introductions, broadcast lower-third and production cues. */
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(process.argv[2]||".");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"js/app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"css/main.css"),"utf8");
for(const id of ["studio-intro","intro-player-one","intro-player-two","intro-chaser-strength","dismiss-studio-intro","studio-broadcast-headline","studio-broadcast-detail","studio-p1-status","studio-p2-status","studio-chaser-status"])
  if(!html.includes('id="'+id+'"'))throw new Error("Missing studio production element: "+id);
for(const marker of ["function showStudioIntro","function hideStudioIntro","function announcePhase","setStudioBroadcast","showStudioIntro(currentMatch)","dismiss-studio-intro"])
  if(!app.includes(marker))throw new Error("Missing studio interaction: "+marker);
for(const marker of [".studio-intro[hidden]",".broadcast-lower-third","@keyframes intro-card-in","@keyframes intro-lights","@media(prefers-reduced-motion:reduce)"])
  if(!css.includes(marker))throw new Error("Missing studio presentation/accessibility style: "+marker);
if(!html.includes("VERSION 1.7"))throw new Error("Studio edition version label not updated.");
console.log("M14 studio test passed: contestant introduction, interactive dismissal, phase calls, player spotlights and responsive reduced-motion styling present.");
