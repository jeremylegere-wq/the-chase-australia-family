/* M8 question management: local custom questions, portable JSON import/export. */
(function () {
  "use strict";
  const game = window.ChaseGame = window.ChaseGame || {};
  const STORAGE = "the-chase-australia-family.custom-questions.v1";
  const $ = id => document.getElementById(id);
  const builtIn = game.questionBank || [];
  const originalBuiltIn = builtIn.slice();
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem(STORAGE) || "[]"); } catch (_) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  const valid = q => q && typeof q.id === "string" && q.question && ["junior","family","challenge"].includes(q.difficulty) &&
    Array.isArray(q.answers) && q.answers.length === 4 && q.answers.every(a => typeof a === "string" && a.trim()) &&
    Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer <= 3 && q.category;
  custom = custom.filter(valid);
  function syncBank() { builtIn.splice(0, builtIn.length, ...originalBuiltIn, ...custom); }
  function persist() { localStorage.setItem(STORAGE, JSON.stringify(custom)); syncBank(); }
  syncBank();
  function all() { return builtIn; }
  game.getQuestionBank = all;
  game.getCustomQuestions = () => custom.slice();
  function stats() {
    const questions = all();
    const by = d => questions.filter(q => q.difficulty === d).length;
    $("question-library-summary").textContent = questions.length + " questions · " + custom.length + " custom";
    $("manager-stats").innerHTML = ["junior","family","challenge"].map(d => `<div><span>${d.toUpperCase()}</span><strong>${by(d)}</strong></div>`).join("") +
      `<div><span>TOTAL</span><strong>${questions.length}</strong></div>`;
    const recent = custom.slice(-8).reverse();
    $("custom-question-list").replaceChildren();
    if (!recent.length) { const p=document.createElement("p"); p.textContent="No custom questions yet."; $("custom-question-list").append(p); }
    recent.forEach(q => {
      const row=document.createElement("div"); row.className="custom-question-row";
      const info=document.createElement("span"); info.textContent=`${q.question} · ${q.category} · ${q.difficulty}`;
      const del=document.createElement("button"); del.type="button"; del.className="btn btn-quiet"; del.textContent="REMOVE";
      del.addEventListener("click",()=>{ custom=custom.filter(x=>x.id!==q.id); persist(); stats(); });
      row.append(info,del); $("custom-question-list").append(row);
    });
  }
  $("open-question-manager").addEventListener("click",()=>{ stats(); $("question-manager-dialog").showModal(); });
  $("custom-question-form").addEventListener("submit",e=>{
    e.preventDefault();
    const answers=["a","b","c","d"].map(k=>$("custom-"+k).value.trim());
    const q={id:"U"+Date.now().toString(36).toUpperCase(),category:$("custom-category").value,difficulty:$("custom-difficulty").value,
      question:$("custom-question").value.trim(),answers,correctAnswer:Number($("custom-correct").value),
      explanation:$("custom-explanation").value.trim(),tags:["custom"]};
    if(!valid(q)){ $("manager-feedback").textContent="Please complete the question and all four answers."; return; }
    custom.push(q); persist(); e.target.reset(); $("custom-difficulty").value="family";
    $("manager-feedback").textContent="Question added and saved in this browser.";
    stats();
  });
  function download(filename, data) {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }
  $("export-question-bank").addEventListener("click",()=>download("the-chase-question-bank.json",{version:2,language:"en-AU",questions:all()}));
  $("import-question-bank").addEventListener("change",async e=>{
    const file=e.target.files && e.target.files[0]; if(!file)return;
    try {
      const parsed=JSON.parse(await file.text()); const incoming=Array.isArray(parsed)?parsed:parsed.questions;
      if(!Array.isArray(incoming)||!incoming.every(valid)) throw new Error("Every question must have an ID, category, difficulty, four answers and a correct-answer index.");
      const known=new Set(all().map(q=>q.id)); let added=0;
      incoming.forEach(q=>{ if(!known.has(q.id)){custom.push({...q,tags:[...(q.tags||[]),"imported"]});known.add(q.id);added++;} });
      persist(); stats(); $("manager-feedback").textContent=`Imported ${added} new questions. Duplicate IDs were skipped.`;
    } catch(err) { $("manager-feedback").textContent="Import failed: "+err.message; }
    e.target.value="";
  });
  stats();
})();