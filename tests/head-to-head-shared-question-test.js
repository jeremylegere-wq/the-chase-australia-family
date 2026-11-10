"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),store={};
const c={window:{},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},Math,Date,JSON};c.window=c;c.ChaseGame={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[2]+"/js/match-state.js","utf8"),c);
const e=c.ChaseGame.matchEngine;
const app=fs.readFileSync(process.argv[2]+"/js/app.js","utf8");
assert(app.includes("const qid = chase.questionIds[chase.questionIndex];"),"Chaser must read the current contestant question ID.");
assert(app.includes("const q = bank.find(item => item.id === chase.questionIds[chase.questionIndex]);"),"Contestant must see the same current question ID.");
assert(app.includes("const nextQuestion = selectQuestionIds(1)[0];"),"Long chases must draw additional unused questions as needed.");
assert(app.includes("engine.resolveHeadToHeadTurn(currentMatch, contestantCorrect, correct)"),"Both answers must be resolved together.");
let m=e.createMatch({players:["Alex","Sam"]});m=e.beginCashBuilder(m,Array.from({length:20},(_,i)=>"C"+i),10,20);for(let i=0;i<20;i++)m=e.resolveCashBuilderAnswer(m,true,false);m=e.advancePhase(m);
const ids=["H0"];m=e.beginHeadToHead(m,0,"standard",5000,ids);
assert.deepEqual(Array.from(m.headToHead.questionIds),ids);assert.equal("chaserQuestionIds" in m.headToHead,false,"Head-to-Head must not maintain a separate Chaser question list.");
const firstQuestion=m.headToHead.questionIds[m.headToHead.questionIndex];m=e.resolveHeadToHeadTurn(m,true,false);
assert.equal(m.headToHead.questionIndex,1);assert.equal(m.headToHead.contestantPosition,3);assert.equal(m.headToHead.chaserPosition,0);assert.equal(m.headToHead.contestantTurns,1);assert.equal(m.headToHead.chaserTurns,1);assert.equal(m.players[0].correctAnswers,11);assert.equal(m.players[0].incorrectAnswers,0);
assert.equal(firstQuestion,ids[0]);assert.equal(m.headToHead.lastResolvedQuestionId,ids[0]);
m.headToHead.questionIds.push("H1");assert.equal(m.headToHead.questionIds[m.headToHead.questionIndex],"H1");
// If both answer correctly on the final step, reaching HOME wins before a simultaneous catch check.
m.headToHead.contestantPosition=6;m.headToHead.chaserPosition=5;m.headToHead.questionIndex=1;m=e.resolveHeadToHeadTurn(m,true,true);assert.equal(m.headToHead.status,"won");assert.equal(m.headToHead.contestantPosition,7);assert.equal(m.headToHead.chaserPosition,6);
console.log("Head-to-Head shared-question tests passed: UI uses one shared question ID, both answers resolve together, both counters record, and HOME outcome has priority.");
