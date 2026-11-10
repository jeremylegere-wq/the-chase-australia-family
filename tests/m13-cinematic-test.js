/* M13: verify cinematic layer, procedural audio and character reaction support. */
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(process.argv[2]||".");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"js/app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"css/main.css"),"utf8");
for(const id of ["cinematic-flash","cinematic-caption"])
  if(!html.includes('id="'+id+'"'))throw new Error("Missing cinematic presentation element: "+id);
for(const marker of ["function cinematicMoment","function sweep","cinematicCopy","reaction-happy","reaction-shock","reaction-intense"])
  if(!app.includes(marker))throw new Error("Missing M13 runtime feature: "+marker);
for(const marker of ["@keyframes cinematic-hit","@keyframes reaction-happy","@keyframes reaction-shock","@keyframes reaction-intense","@media(prefers-reduced-motion:reduce)"])
  if(!css.includes(marker))throw new Error("Missing M13 animation/accessibility rule: "+marker);
if(!app.includes("AudioContext")||!app.includes("exponentialRampToValueAtTime"))
  throw new Error("Procedural Web Audio synthesis is missing.");
if(app.includes("https://")||app.includes("http://"))throw new Error("Unexpected remote runtime dependency in app.js.");
console.log("M13 cinematic test passed: overlay, original Web Audio synthesis, character reactions and reduced-motion support present.");
