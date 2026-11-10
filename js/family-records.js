/* M16: local contestant profiles, career statistics, achievements and family records. */
(function () {
  "use strict";
  const STORAGE_KEY = "the-chase-australia-family.records.v1";
  const ACHIEVEMENTS = [
    { id: "first_match", title: "FIRST APPEARANCE", detail: "Complete your first match.", icon: "🎬" },
    { id: "first_win", title: "FIRST VICTORY", detail: "Beat the Chaser for the first time.", icon: "🏆" },
    { id: "five_matches", title: "REGULAR CONTESTANT", detail: "Complete five matches.", icon: "⭐" },
    { id: "twenty_five_correct", title: "QUIZ MACHINE", detail: "Answer 25 questions correctly.", icon: "🧠" },
    { id: "perfect_match", title: "FLAWLESS FORM", detail: "Finish a match without an incorrect answer.", icon: "💎" },
    { id: "big_bank", title: "BIG BANK BUILDER", detail: "Earn at least $10,000 in one Cash Builder.", icon: "💰" },
    { id: "team_win", title: "TEAM PLAYER", detail: "Win a cooperative match.", icon: "🤝" },
    { id: "versus_win", title: "TOP CONTESTANT", detail: "Win a competitive match.", icon: "⚡" }
  ];
  function emptyStore() { return { schemaVersion: 1, profiles: {}, completedMatchIds: [], recentMatches: [], updatedAt: new Date().toISOString() }; }
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!value || value.schemaVersion !== 1 || !value.profiles || !Array.isArray(value.completedMatchIds) || !Array.isArray(value.recentMatches)) return emptyStore();
      return value;
    } catch (_) { return emptyStore(); }
  }
  function save(store) {
    store.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; } catch (_) { return false; }
  }
  function keyFor(name) { return String(name || "Contestant").trim().toLocaleLowerCase("en-AU").replace(/\s+/g, " ").slice(0, 40); }
  function makeProfile(name) {
    return { id:keyFor(name), name:String(name||"Contestant").trim().slice(0,16), matches:0, wins:0, losses:0, correct:0, incorrect:0, cashBuilderEarned:0, bestCashBuilder:0, bestFinalScore:0, cooperativeWins:0, competitiveWins:0, achievements:[], lastPlayedAt:null };
  }
  function earnedFor(profile, mode, won, earned) {
    const ids=[];
    if(profile.matches>=1)ids.push("first_match");
    if(profile.wins>=1)ids.push("first_win");
    if(profile.matches>=5)ids.push("five_matches");
    if(profile.correct>=25)ids.push("twenty_five_correct");
    if(earned.incorrect===0)ids.push("perfect_match");
    if(earned.cashBuilder>=10000)ids.push("big_bank");
    if(mode==="cooperative"&&won)ids.push("team_win");
    if(mode==="competitive"&&won)ids.push("versus_win");
    return ids;
  }
  function recordMatch(match) {
    if(!match||!match.matchId||!match.finalChase||!match.finalChase.completed)return {recorded:false,reason:"Match is not complete."};
    const store=load();
    if(store.completedMatchIds.includes(match.matchId))return {recorded:false,duplicate:true};
    const won=match.finalChase.outcome==="contestants_win";
    const participants=[];
    match.players.forEach(player=>{
      const id=keyFor(player.name),profile=store.profiles[id]||makeProfile(player.name);
      const earned={correct:Number(player.correctAnswers||0),incorrect:Number(player.incorrectAnswers||0),cashBuilder:Number(player.contribution||0)};
      profile.matches+=1;if(won)profile.wins+=1;else profile.losses+=1;
      profile.correct+=earned.correct;profile.incorrect+=earned.incorrect;profile.cashBuilderEarned+=earned.cashBuilder;
      profile.bestCashBuilder=Math.max(profile.bestCashBuilder,earned.cashBuilder);
      profile.bestFinalScore=Math.max(profile.bestFinalScore,Number(match.finalChase.contestantScore||0));
      if(won&&match.mode==="cooperative")profile.cooperativeWins+=1;
      if(won&&match.mode==="competitive")profile.competitiveWins+=1;
      profile.lastPlayedAt=new Date().toISOString();
      const unlocked=earnedFor(profile,match.mode,won,earned);
      const newAchievements=unlocked.filter(a=>!profile.achievements.includes(a));
      profile.achievements=[...new Set(profile.achievements.concat(unlocked))];
      store.profiles[id]=profile;participants.push({name:profile.name,correct:earned.correct,cashBuilder:earned.cashBuilder,newAchievements});
    });
    const summary={id:match.matchId,date:new Date().toISOString(),mode:match.mode,players:participants.map(p=>p.name),outcome:won?"Contestants beat the Chaser":"The Chaser won",contestantScore:Number(match.finalChase.contestantScore||0),chaserScore:Number(match.finalChase.chaserScore||0),prize:won?Number(match.teamBank||0):0,achievements:participants.reduce((n,p)=>n+p.newAchievements.length,0)};
    store.completedMatchIds.push(match.matchId);if(store.completedMatchIds.length>500)store.completedMatchIds=store.completedMatchIds.slice(-500);
    store.recentMatches.unshift(summary);store.recentMatches=store.recentMatches.slice(0,12);
    const persisted=save(store);renderDashboard();refreshProfileList();
    return {recorded:persisted,summary,participants};
  }
  function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;}
  function renderDashboard(){
    const store=load(),profiles=Object.values(store.profiles).sort((a,b)=>b.wins-a.wins||b.correct-a.correct||b.matches-a.matches||a.name.localeCompare(b.name));
    const summary=document.getElementById("family-records-summary"),list=document.getElementById("family-profile-list"),ach=document.getElementById("family-achievement-list"),recent=document.getElementById("family-recent-list");
    if(!summary||!list||!ach||!recent)return;
    summary.replaceChildren();
    [[String(store.completedMatchIds.length),"MATCHES PLAYED"],[String(profiles.reduce((n,p)=>n+p.wins,0)),"CONTESTANT WINS"],[String(profiles.length),"PROFILES"]].forEach(([v,l])=>{const x=el("div","records-stat");x.append(el("strong","",v),el("span","",l));summary.append(x);});
    list.replaceChildren();if(!profiles.length)list.append(el("p","records-empty","Play your first match to create a profile."));
    profiles.forEach((p,i)=>{
      const card=el("article","family-profile-card"),top=el("div","profile-card-top");top.append(el("strong","",p.name),el("span","profile-rank",i===0?"★ TOP CONTESTANT":"CONTESTANT"));
      const accuracy=p.correct+p.incorrect?Math.round(p.correct/(p.correct+p.incorrect)*100):0,stats=el("div","profile-stat-grid");
      [[p.matches,"PLAYED"],[p.wins,"WINS"],[p.losses,"LOSSES"],[p.correct,"CORRECT"],[accuracy+"%","ACCURACY"],["$"+p.cashBuilderEarned.toLocaleString("en-AU"),"TOTAL CASH BUILT"],["$"+p.bestCashBuilder.toLocaleString("en-AU"),"BEST CASH BUILDER"],[p.bestFinalScore,"BEST FINAL SCORE"]].forEach(([v,l])=>{const cell=el("div","");cell.append(el("b","",String(v)),el("small","",l));stats.append(cell);});
      const badges=el("div","profile-badges");p.achievements.forEach(id=>{const a=ACHIEVEMENTS.find(x=>x.id===id);if(a)badges.append(el("span","achievement-mini",a.icon+" "+a.title));});
      card.append(top,stats,badges);list.append(card);
    });
    ach.replaceChildren();const unlocked=new Set(profiles.flatMap(p=>p.achievements));
    ACHIEVEMENTS.forEach(a=>{const row=el("div","achievement-row"+(unlocked.has(a.id)?" unlocked":" locked"));row.append(el("span","achievement-icon",a.icon));const copy=el("div","achievement-copy");copy.append(el("strong","",a.title),el("small","",a.detail));row.append(copy,el("span","achievement-state",unlocked.has(a.id)?"UNLOCKED":"LOCKED"));ach.append(row);});
    recent.replaceChildren();if(!store.recentMatches.length)recent.append(el("p","records-empty","No completed matches yet."));
    store.recentMatches.slice(0,8).forEach(m=>{const row=el("div","recent-match-row"),info=el("div","");info.append(el("strong","",m.players.join(" & ")),el("small","",new Date(m.date).toLocaleDateString("en-AU")+" · "+m.mode.toUpperCase()+" · "+m.contestantScore+"–"+m.chaserScore));row.append(info,el("b",m.prize>0?"recent-win":"recent-loss",m.outcome+(m.prize>0?" · $"+m.prize.toLocaleString("en-AU"):"")));recent.append(row);});
  }
  function refreshProfileList(){const list=document.getElementById("contestant-profile-list");if(!list)return;list.replaceChildren();Object.values(load().profiles).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{const o=document.createElement("option");o.value=p.name;list.append(o);});}
  function reset(){if(!window.confirm("Reset all family profiles, achievements and match records on this device? This cannot be undone."))return false;try{localStorage.removeItem(STORAGE_KEY);}catch(_){}renderDashboard();refreshProfileList();return true;}
  window.ChaseFamilyRecords={recordMatch,renderDashboard,refreshProfileList,reset,load};
  document.addEventListener("DOMContentLoaded",()=>{renderDashboard();refreshProfileList();});
})();
