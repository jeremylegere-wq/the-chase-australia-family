/* M7: Broadcast-style presentation layered over the complete family match. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const engine = window.ChaseGame.matchEngine;
  const bank = window.ChaseGame.getQuestionBank ? window.ChaseGame.getQuestionBank() : (window.ChaseGame.questionBank || []);
  let currentMatch = null;
  let saved = false;
  let timerHandle = null;
  let questionLocked = false;
  let pendingFeedback = null;
  let selectedOffer = "standard";

  const LENGTHS = { short: 5, standard: 10, long: 15 };
  const QUESTION_SECONDS = 20;
  const SOUND_KEY = "chase-family-sound";
  let soundEnabled = localStorage.getItem(SOUND_KEY) === "on";
  let finalResultAnnounced = false;
  let audioContext = null;
  let lastAnnouncedPhase = null;
  let lastAnnouncedPlayer = null;
  let introReturnFocus = null;
  function syncSoundButton() {
    const button = $("sound-toggle");
    if (!button) return;
    button.textContent = soundEnabled ? "🔊 SOUND ON" : "🔇 SOUND OFF";
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.title = soundEnabled ? "Turn sound off" : "Turn sound on";
  }
  function tone(frequency, duration, type, volume, delay) {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = audioContext || new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + (delay || 0);
      oscillator.type = type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + duration + 0.03);
    } catch (_) { /* Audio is an optional enhancement; gameplay must still work. */ }
  }
  const cinematicCopy = {
    start: "THE CHASE IS ON!",
    correct: "CORRECT!",
    wrong: "NOT THIS TIME!",
    chaser: "THE CHASER STRIKES!",
    win: "YOU BEAT THE CHASER!",
    lose: "THE CHASER WINS!",
    reveal: "HERE COMES THE CHASER..."
  };
  let cinematicTimer = null;
  function cinematicMoment(kind) {
    const flash = $("cinematic-flash"), caption = $("cinematic-caption");
    if (flash && caption && cinematicCopy[kind]) {
      caption.textContent = cinematicCopy[kind];
      flash.className = "cinematic-flash cinematic-" + kind + " cinematic-active";
      if (cinematicTimer) window.clearTimeout(cinematicTimer);
      cinematicTimer = window.setTimeout(() => flash.classList.remove("cinematic-active"), kind === "win" || kind === "lose" ? 1700 : 780);
    }
    const reaction = kind === "correct" || kind === "win" ? "reaction-happy" :
      kind === "wrong" || kind === "lose" ? "reaction-shock" :
      kind === "chaser" || kind === "reveal" ? "reaction-intense" : "reaction-ready";
    document.querySelectorAll(".chase-character img,.race-chaser-sprite,.race-team-sprite").forEach(el => {
      el.classList.remove("reaction-happy","reaction-shock","reaction-intense","reaction-ready");
      void el.offsetWidth; el.classList.add(reaction);
      window.setTimeout(() => el.classList.remove(reaction), 1050);
    });
  }
  function sweep(startFrequency, endFrequency, duration, type, volume, delay) {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = audioContext || new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      const at = audioContext.currentTime + (delay || 0);
      osc.type = type || "sawtooth";
      osc.frequency.setValueAtTime(startFrequency, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency), at + duration);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume || .035, at + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start(at); osc.stop(at + duration + .03);
    } catch (_) {}
  }
  function playSound(kind) {
    cinematicMoment(kind);
    if (!soundEnabled) return;
    const cues = {
      reveal: [[440,.12,"triangle",.045,0],[660,.18,"triangle",.05,.10]],
      correct: [[523,.12,"sine",.06,0],[784,.2,"sine",.07,.11]],
      wrong: [[220,.25,"triangle",.055,0],[165,.28,"triangle",.05,.13]],
      tick: [[880,.055,"square",.025,0]],
      chaser: [[330,.13,"sawtooth",.035,0],[247,.2,"sawtooth",.04,.14]],
      win: [[523,.2,"triangle",.06,0],[659,.2,"triangle",.06,.16],[784,.32,"triangle",.07,.32],[1046,.45,"triangle",.07,.52]],
      lose: [[330,.2,"triangle",.05,0],[247,.25,"triangle",.05,.18],[165,.4,"triangle",.05,.4]],
      start: [[392,.12,"triangle",.045,0],[523,.16,"triangle",.05,.14],[659,.24,"triangle",.06,.3],[784,.32,"triangle",.055,.48]],
      reveal: [[220,.32,"sawtooth",.025,0],[330,.28,"sawtooth",.035,.22],[440,.34,"triangle",.04,.48]],
      chaser: [[330,.13,"sawtooth",.035,0],[247,.2,"sawtooth",.04,.14],[196,.3,"sawtooth",.04,.3]],
      tick: [[880,.055,"square",.025,0],[660,.045,"square",.018,.07]]
    };
    (cues[kind] || []).forEach(c => tone(...c));
    if (kind === "reveal") { sweep(110,660,.72,"sawtooth",.028,.02); tone(880,.18,"triangle",.04,.72); }
    if (kind === "chaser") { sweep(520,90,.42,"sawtooth",.035,.02); }
    if (kind === "win") { tone(1046,.5,"triangle",.065,.85); tone(1318,.65,"triangle",.055,1.05); }
    if (kind === "lose") { sweep(420,75,.8,"triangle",.035,.04); }
    if (kind === "start") { sweep(180,720,.55,"triangle",.025,.02); }
  }
  function animateElement(id, className) {
    const el = $(id); if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => el.classList.remove(className), 900);
  }

  function setStudioBroadcast(headline, detail, mood) {
    const title = $("studio-broadcast-headline"), sub = $("studio-broadcast-detail");
    if (title) title.textContent = headline;
    if (sub) sub.textContent = detail;
    const bar = document.querySelector(".broadcast-lower-third");
    if (bar) {
      bar.classList.remove("broadcast-excited","broadcast-warning","broadcast-victory");
      if (mood) bar.classList.add("broadcast-" + mood);
    }
  }
  function showStudioIntro(match) {
    const panel = $("studio-intro");
    if (!panel || !match) return;
    introReturnFocus = document.activeElement;
    $("intro-player-one").textContent = match.players[0].name.toUpperCase();
    $("intro-player-two").textContent = match.players[1].name.toUpperCase();
    $("intro-chaser-strength").textContent = match.chaser.toUpperCase() + " STRENGTH · " + (CHASER_PERSONAS[match.chaserPersonality] || CHASER_PERSONAS.professor).name;
    $("studio-intro-kicker").textContent = match.mode === "cooperative" ? "TONIGHT · TEAM CHALLENGE" : "TONIGHT · HEAD-TO-HEAD";
    $("studio-intro-title").textContent = "MEET THE CONTESTANTS";
    panel.hidden = false;
    document.body.classList.add("studio-intro-open");
    playSound("reveal");
    window.setTimeout(() => $("dismiss-studio-intro").focus(), 30);
  }
  function hideStudioIntro() {
    const panel = $("studio-intro");
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    document.body.classList.remove("studio-intro-open");
    if (introReturnFocus && typeof introReturnFocus.focus === "function") introReturnFocus.focus();
  }
  const CHASER_PERSONAS = {
    professor: { name: "THE PROFESSOR", intro: "Quietly confident. Every move is measured.", correct: ["A precise answer. The Professor closes the gap.", "No hesitation. The Professor makes it count."], wrong: ["A rare slip from the Professor. The team gets a little breathing room.", "Even the Professor can be caught out."], taunt: ["The Professor is studying every move.", "A calm presence, but never an easy opponent."] },
    enforcer: { name: "THE ENFORCER", intro: "Relentless pressure. The Enforcer never backs off.", correct: ["The Enforcer powers forward!", "No mercy on the board. The Enforcer moves."], wrong: ["A stumble from the Enforcer! That's a chance to get away.", "The pressure eases for a moment. The Enforcer misses."], taunt: ["The Enforcer is turning up the heat.", "You can feel the pressure building."] },
    trickster: { name: "THE TRICKSTER", intro: "A cheeky challenger who loves a twist.", correct: ["The Trickster has another trick up their sleeve.", "A cheeky grin, and one space closer."], wrong: ["The joke's on the Trickster this time!", "That trick didn't work. The contestants can breathe."], taunt: ["The Trickster is enjoying this game a little too much.", "A wink from the Chaser. Don't get distracted!"] }
  };
  const PRESENTER_STYLES = {
    warm: { label: "WARM & ENCOURAGING", correct: ["Brilliant work! Keep that confidence going.", "That's what teamwork looks like. Well played."], wrong: ["That's alright. Take a breath and reset.", "No worries. There's another question coming."], close: ["It's getting tight now. Every answer matters."], win: ["What a performance! You stayed together and got it done."], lose: ["A tough contest, and a terrific effort from both contestants."] },
    dramatic: { label: "BIG-MATCH DRAMA", correct: ["The studio erupts! What a moment!", "A huge answer under pressure!"], wrong: ["A twist in the contest! The pressure is rising.", "The momentum swings. Can they recover?"], close: ["One step between them. This chase is on a knife-edge!"], win: ["INCREDIBLE! The contestants have beaten the Chaser!"], lose: ["The Chaser gets there! What a finish to the contest."] },
    playful: { label: "PLAYFUL & WITTY", correct: ["Someone came prepared! Lovely answer.", "Put that one in the family quiz hall of fame."], wrong: ["The answer was hiding in plain sight. On we go!", "A brave guess. The question had other plans."], close: ["Someone might want to check the rear-view mirror. It's close!"], win: ["That's how you make a Chaser chase their lunch!"], lose: ["The Chaser takes the bragging rights this time. Rematch?"] }
  };
  function commentary(kind, detail) {
    if (!currentMatch) return;
    const presenter = PRESENTER_STYLES[currentMatch.presenterStyle] || PRESENTER_STYLES.warm;
    const chaser = CHASER_PERSONAS[currentMatch.chaserPersonality] || CHASER_PERSONAS.professor;
    const choose = (items) => items[Math.floor(Math.random() * items.length)];
    let headline = "FROM THE STUDIO", line = "";
    if (kind === "correct" || kind === "wrong") {
      line = choose(presenter[kind]);
      headline = kind === "correct" ? "THAT'S THE ANSWER!" : "NOT THIS TIME";
    } else if (kind === "chaser_correct") { headline = chaser.name + " STRIKES"; line = choose(chaser.correct); }
    else if (kind === "chaser_wrong") { headline = chaser.name + " MISSES"; line = choose(chaser.wrong); }
    else if (kind === "close") { headline = "IT'S GETTING CLOSE"; line = choose(presenter.close); }
    else if (kind === "win" || kind === "lose") { headline = kind === "win" ? "THE CONTESTANTS WIN!" : "THE CHASER WINS"; line = choose(presenter[kind]); }
    else if (kind === "escape") { headline = "HOME! THE PRIZE IS SAFE"; line = currentMatch.mode === "cooperative" ? "A brilliant team effort. The prize is coming back to the team." : "A huge result. That contestant has beaten the Chaser."; }
    else if (kind === "caught") { headline = "CAUGHT BY THE CHASER"; line = currentMatch.mode === "cooperative" ? "The Chaser gets there this time. The team must regroup." : "The Chaser shuts the door on that offer. The contest moves on."; }
    else if (kind === "offer") { headline = "A BIG DECISION"; line = detail || "The offer is on the table. Choose carefully."; }
    else if (kind === "final") { headline = "THE FINAL CHASE"; line = currentMatch.mode === "cooperative" ? "One team, one goal. Work together and stay ahead." : "The final test is here. Every point could decide it."; }
    else { line = detail || choose(chaser.taunt); }
    if (currentMatch.mode === "competitive" && (kind === "correct" || kind === "wrong")) line += " The individual contest is still wide open.";
    setStudioBroadcast(headline, line, kind === "win" ? "victory" : kind === "wrong" || kind === "chaser_correct" ? "warning" : "excited");
  }

  function announcePhase(match) {
    const phase = match.phase;
    if (phase !== lastAnnouncedPhase) {
      lastAnnouncedPhase = phase;
      const calls = {
        cash_builder: ["THE CASH BUILDER", "Two contestants. One minute? No, 20 seconds per question. Let's build that bank.", "excited"],
        head_to_head: ["HEAD-TO-HEAD", "Choose your offer and face the Chaser on the board.", "warning"],
        final_chase: ["THE FINAL CHASE", "The team must stay ahead. Every correct answer counts.", "warning"],
        results: ["THAT'S THE CHASE!", "The final result is in. Let's hear it for our contestants.", "victory"]
      };
      const call = calls[phase] || ["THE CHASE", "The match is underway.", ""];
      setStudioBroadcast(call[0], call[1], call[2]);
      if (phase === "head_to_head") commentary("offer", (CHASER_PERSONAS[match.chaserPersonality] || CHASER_PERSONAS.professor).intro);
      if (phase === "final_chase") commentary("final");
      const shell = document.querySelector(".studio-shell");
      if (shell) {
        shell.classList.remove("studio-phase-cash","studio-phase-chase","studio-phase-final","studio-phase-results");
        shell.classList.add("studio-phase-" + (phase === "cash_builder" ? "cash" : phase === "head_to_head" ? "chase" : phase === "final_chase" ? "final" : "results"));
      }
      if (phase !== "cash_builder") playSound("reveal");
    }
    const active = match.players[match.activePlayerIndex];
    if (active && active.name !== lastAnnouncedPlayer) {
      lastAnnouncedPlayer = active.name;
      setStudioBroadcast("UP NEXT: " + active.name.toUpperCase(), phase === "head_to_head" ? "Step up to the board and choose your offer." : "You're in the spotlight. Your turn is coming up.", "excited");
    }
    $("studio-p1-status").textContent = match.activePlayerIndex === 0 ? "● YOUR TURN" : (match.players[0].chaseComplete ? "CHASE COMPLETE" : "READY");
    $("studio-p2-status").textContent = match.activePlayerIndex === 1 ? "● YOUR TURN" : (match.players[1].chaseComplete ? "CHASE COMPLETE" : "READY");
    const podiums = document.querySelectorAll(".contestant-podium");
    podiums.forEach((podium,index) => podium.classList.toggle("podium-active", match.activePlayerIndex === index && phase !== "results"));
    $("studio-chaser-status").textContent = phase === "final_chase" ? "IN THE FINAL CHASE" : phase === "results" ? "MATCH COMPLETE" : phase === "head_to_head" ? "ON THE BOARD" : "WAITING IN THE WINGS";
  }

  const money = (value) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
  const shuffle = (items) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  function stopTimer() {
    if (timerHandle) window.clearInterval(timerHandle);
    timerHandle = null;
  }
  function setMessage(message) { $("turn-message").textContent = message; }
  function setFeedback(message, kind) {
    $("answer-feedback").textContent = message;
    $("answer-feedback").className = "answer-feedback" + (kind ? " " + kind : "");
  }
  function setSaveStatus(isSaved, label) {
    saved = isSaved;
    $("save-indicator").textContent = label || (isSaved ? "SAVED LOCALLY" : "UNSAVED CHANGES");
    $("save-indicator").classList.toggle("saved", isSaved);
  }
  function currentQuestion() {
    if (!currentMatch || !currentMatch.cashBuilder || currentMatch.cashBuilder.completed) return null;
    const id = currentMatch.cashBuilder.questionIds[currentMatch.cashBuilder.currentQuestionIndex];
    return bank.find(q => q.id === id) || null;
  }
  function eligibleQuestions() {
    const difficulty = currentMatch.difficulty || "family";
    const category = currentMatch.categories || "mixed";
    let candidates = bank.filter(q => q.difficulty === difficulty);
    if (category === "sport") candidates = candidates.filter(q => q.category === "Sport");
    if (category === "world") candidates = candidates.filter(q => ["Animals","Science","Geography","Nature","Space"].includes(q.category));
    if (category === "junior") candidates = candidates.filter(q => q.tags && q.tags.includes("junior"));
    if (category === "australia") candidates = candidates.filter(q => ["Australia","Geography","Sport","History"].includes(q.category) && ((q.tags||[]).includes("australia") || q.category === "Australia"));
    if (category === "science") candidates = candidates.filter(q => ["Science","Nature","Space"].includes(q.category));
    if (category === "history") candidates = candidates.filter(q => ["History","Literature","Music"].includes(q.category));
    if (category === "geography") candidates = candidates.filter(q => q.category === "Geography");
    if (category === "animals") candidates = candidates.filter(q => ["Animals","Nature"].includes(q.category));
    return candidates;
  }

  // M11: one shuffled deck belongs to the match, not to an individual round.
  // Questions are removed from the deck when dealt and only reshuffled after the
  // entire eligible difficulty pool has been used.
  function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  function uniqueQuestionPrompts(items) {
    const seen = new Set();
    return items.filter(q => {
      const key = String(q.question || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function eligibleQuestions() {
    const difficulty = currentMatch.difficulty || "family";
    const category = currentMatch.categories || "mixed";
    let candidates = bank.filter(q => q.difficulty === difficulty);
    if (category === "sport") candidates = candidates.filter(q => q.category === "Sport");
    if (category === "world") candidates = candidates.filter(q => ["Animals","Science","Geography","Nature","Space"].includes(q.category));
    if (category === "junior") candidates = candidates.filter(q => q.tags && q.tags.includes("junior"));
    if (category === "australia") candidates = candidates.filter(q => ["Australia","Geography","Sport","History"].includes(q.category) && ((q.tags||[]).includes("australia") || q.category === "Australia"));
    if (category === "science") candidates = candidates.filter(q => ["Science","Nature","Space"].includes(q.category));
    if (category === "history") candidates = candidates.filter(q => ["History","Literature","Music"].includes(q.category));
    if (category === "geography") candidates = candidates.filter(q => q.category === "Geography");
    if (category === "animals") candidates = candidates.filter(q => ["Animals","Nature"].includes(q.category));
    return uniqueQuestionPrompts(candidates);
  }
  function createQuestionDeck() {
    const difficultyPool = uniqueQuestionPrompts(bank.filter(q => q.difficulty === (currentMatch.difficulty || "family")));
    const preferred = eligibleQuestions();
    const preferredIds = new Set(preferred.map(q => q.id));
    const remainder = difficultyPool.filter(q => !preferredIds.has(q.id));
    // Deduplicate identical prompt text as well as IDs. Category preference stays
    // near the front, with the full unique difficulty pool available as fallback.
    const pool = uniqueQuestionPrompts([...shuffleInPlace(preferred.slice()), ...shuffleInPlace(remainder.slice())]);
    currentMatch.questionDeck = {
      poolIds: pool.map(q => q.id),
      remainingIds: pool.map(q => q.id),
      usedIds: [],
      cycleUsedIds: [],
      cycle: 1
    };
  }
  function ensureQuestionDeck() {
    if (!currentMatch.questionDeck || !Array.isArray(currentMatch.questionDeck.remainingIds) ||
        !Array.isArray(currentMatch.questionDeck.poolIds)) {
      createQuestionDeck();
      return;
    }
    // Repair decks saved by earlier releases: remove missing IDs, duplicate IDs
    // and duplicate prompt text, then reconstruct this cycle's consumed set from
    // the saved remaining queue when the newer tracking field is absent.
    const original = currentMatch.questionDeck;
    const validIds = new Set(bank.map(q => q.id));
    const seenPrompts = new Set();
    const poolIds = original.poolIds.filter(id => {
      if (!validIds.has(id)) return false;
      const q = bank.find(item => item.id === id);
      const prompt = String(q && q.question || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
      if (!prompt || seenPrompts.has(prompt)) return false;
      seenPrompts.add(prompt);
      return true;
    });
    if (!poolIds.length) {
      createQuestionDeck();
      return;
    }
    const poolSet = new Set(poolIds);
    const remainingIds = [...new Set(original.remainingIds)].filter(id => poolSet.has(id));
    const cycleUsedIds = Array.isArray(original.cycleUsedIds)
      ? [...new Set(original.cycleUsedIds)].filter(id => poolSet.has(id))
      : poolIds.filter(id => !remainingIds.includes(id));
    original.poolIds = poolIds;
    original.remainingIds = remainingIds.filter(id => !cycleUsedIds.includes(id));
    original.cycleUsedIds = cycleUsedIds;
    original.usedIds = [...new Set((Array.isArray(original.usedIds) ? original.usedIds : []).filter(id => poolSet.has(id)))];
    if (!Number.isInteger(original.cycle) || original.cycle < 1) original.cycle = 1;
  }
  function selectQuestionIds(count) {
    ensureQuestionDeck();
    const deck = currentMatch.questionDeck;
    const result = [];
    const pool = deck.poolIds.filter(id => bank.some(q => q.id === id));
    if (!Array.isArray(deck.cycleUsedIds)) deck.cycleUsedIds = [];
    while (result.length < count && pool.length) {
      // A round can never receive more distinct questions than the unique pool.
      if (result.length >= pool.length) break;
      if (!deck.remainingIds.length) {
        if (deck.cycleUsedIds.length >= pool.length) {
          deck.cycle += 1;
          // A single allocation can cross a cycle boundary. Treat IDs already
          // dealt in this allocation as consumed in the new cycle too, so the
          // same allocation cannot contain a repeated prompt.
          deck.cycleUsedIds = [...new Set(result)];
        }
        const unusedThisCycle = pool.filter(id => !deck.cycleUsedIds.includes(id) && !result.includes(id));
        deck.remainingIds = shuffleInPlace(unusedThisCycle);
      }
      const id = deck.remainingIds.shift();
      if (!id || result.includes(id)) continue;
      result.push(id);
      if (!deck.cycleUsedIds.includes(id)) deck.cycleUsedIds.push(id);
      if (!deck.usedIds.includes(id)) deck.usedIds.push(id);
    }
    return result;
  }
  function renderBanks() {
    const container = $("bank-grid");
    container.replaceChildren();
    currentMatch.players.forEach((player, index) => {
      const card = document.createElement("div");
      card.className = "bank-card" + (index === currentMatch.activePlayerIndex ? " active" : "");
      const label = document.createElement("span");
      label.textContent = currentMatch.mode === "cooperative" ? player.name.toUpperCase() + " · CONTRIBUTION" : player.name.toUpperCase() + " · BANK";
      const amount = document.createElement("strong");
      amount.textContent = money(currentMatch.mode === "cooperative" ? player.contribution : player.bank);
      const detail = document.createElement("small");
      detail.textContent = player.correctAnswers + " correct · " + player.incorrectAnswers + " incorrect · " + player.turnsTaken + " turns" + ((player.securedPrize || 0) ? " · secured " + money(player.securedPrize) : "");
      card.append(label, amount, detail);
      container.append(card);
    });
    if (currentMatch.mode === "cooperative") {
      const team = document.createElement("div");
      team.className = "bank-card active";
      const label = document.createElement("span"); label.textContent = "SHARED TEAM BANK";
      const amount = document.createElement("strong"); amount.textContent = money(currentMatch.teamBank);
      const detail = document.createElement("small"); detail.textContent = "Combined prize total";
      team.append(label, amount, detail); container.append(team);
    }
  }
  function renderQuestion() {
    const cb = currentMatch.cashBuilder;
    const q = currentQuestion();
    const total = cb ? cb.totalQuestions : (LENGTHS[currentMatch.length] || 10) * 2;
    const index = cb ? cb.currentQuestionIndex : 0;
    $("question-counter").textContent = "QUESTION " + Math.min(index + 1, total) + " OF " + total;
    $("question-progress-fill").style.width = (total ? index / total * 100 : 0) + "%";
    $("question-timer").textContent = cb ? String(cb.secondsRemaining) : String(QUESTION_SECONDS);
    $("question-category").textContent = q ? q.category.toUpperCase() : (cb && cb.completed ? "ROUND COMPLETE" : "GET READY");
    $("question-text").textContent = q ? q.question : (cb && cb.completed ? "The Cash Builder is complete. Both contestants have answered all their questions." : "Select Start Cash Builder when both contestants are ready.");
    if (q) animateElement("question-text","studio-reveal");
    const answers = $("answer-grid");
    answers.replaceChildren();
    if (q) {
      q.answers.forEach((answer, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "answer-option";
        button.disabled = questionLocked;
        const letter = document.createElement("span"); letter.className = "answer-letter"; letter.textContent = String.fromCharCode(65 + index);
        const label = document.createElement("span"); label.className = "answer-label"; label.textContent = answer;
        button.append(letter, label);
        button.addEventListener("click", () => submitAnswer(index));
        answers.append(button);
      });
    }
    $("start-cash-builder").hidden = !!cb;
    $("next-question").hidden = true;
    $("next-question").disabled = true;
    $("advance-after-cash").hidden = !(cb && cb.completed);
    if (cb && cb.completed) $("question-progress-fill").style.width = "100%";
  }
  function render() {
    if (!currentMatch) return;
    $("current-phase").textContent = engine.phaseLabels[currentMatch.phase].toUpperCase();
    $("active-player").textContent = currentMatch.players[currentMatch.activePlayerIndex].name.toUpperCase();
    $("current-bank").textContent = money(engine.totalBank(currentMatch));
    $("turn-number").textContent = String(currentMatch.turnNumber);
    $("studio-mode").textContent = currentMatch.mode.toUpperCase() + " MODE";
    $("studio-mode-detail").textContent = currentMatch.mode === "cooperative" ? "TEAM PLAY" : "VERSUS PLAY";
    $("studio-difficulty").textContent = currentMatch.difficulty.toUpperCase();
    $("studio-chaser").textContent = currentMatch.chaser.toUpperCase();
    $("studio-p1").textContent = currentMatch.players[0].name.toUpperCase();
    $("studio-p2").textContent = currentMatch.players[1].name.toUpperCase();
    announcePhase(currentMatch);
    renderBanks();
    if (currentMatch.cashBuilder) renderQuestion();
    renderChaseBoard();
    renderFinalChase();
  }
  function beginCashBuilder() {
    if (!currentMatch) return;
    hideStudioIntro();
    const perPlayer = LENGTHS[currentMatch.length] || 10;
    const required = perPlayer * 2;
    ensureQuestionDeck();
    const ids = selectQuestionIds(required);
    if (ids.length < required) {
      setFeedback("There are not enough questions in this difficulty to start the Cash Builder.", "error");
      return;
    }
    currentMatch = engine.beginCashBuilder(currentMatch, ids, perPlayer, QUESTION_SECONDS);
    playSound("start"); animateElement("question-text","studio-reveal");
    setSaveStatus(false);
    questionLocked = false;
    setFeedback(currentMatch.players[0].name + " is up first. Choose the best answer before the timer reaches zero.");
    setMessage("Cash Builder started. Each contestant has " + perPlayer + " questions.");
    render();
    startTimer();
  }
  function startTimer() {
    stopTimer();
    if (!currentMatch || !currentMatch.cashBuilder || currentMatch.cashBuilder.completed || questionLocked) return;
    timerHandle = window.setInterval(() => {
      const cb = currentMatch.cashBuilder;
      if (!cb || cb.completed || questionLocked) { stopTimer(); return; }
      cb.secondsRemaining = Math.max(0, cb.secondsRemaining - 1);
      $("question-timer").textContent = String(cb.secondsRemaining);
      if (cb.secondsRemaining <= 5) { $("question-timer").classList.add("urgent"); playSound("tick"); }
      else $("question-timer").classList.remove("urgent");
      if (cb.secondsRemaining === 0) submitAnswer(-1, true);
    }, 1000);
  }
  function submitAnswer(answerIndex, timedOut) {
    if (questionLocked || !currentMatch || !currentMatch.cashBuilder || currentMatch.cashBuilder.completed) return;
    const q = currentQuestion();
    if (!q) { setFeedback("The current question could not be found in the question bank.", "error"); return; }
    questionLocked = true;
    stopTimer();
    const correct = !timedOut && answerIndex === q.correctAnswer;
    playSound(correct ? "correct" : "wrong");
    animateElement("answer-feedback","feedback-pop");
    const playerName = currentMatch.players[currentMatch.activePlayerIndex].name;
    currentMatch = engine.resolveCashBuilderAnswer(currentMatch, correct, !!timedOut);
    setSaveStatus(false);
    const options = [...$("answer-grid").querySelectorAll(".answer-option")];
    options.forEach((button, i) => {
      button.disabled = true;
      if (i === q.correctAnswer) button.classList.add("answer-correct");
      if (!timedOut && i === answerIndex && !correct) button.classList.add("answer-wrong");
    });
    if (timedOut) setFeedback("Time is up, " + playerName + "! The correct answer was " + q.answers[q.correctAnswer] + ". " + (q.explanation || ""), "timeout");
    else if (correct) setFeedback("Correct, " + playerName + "! +$1,000. " + (q.explanation || ""), "correct");
    else setFeedback("Not quite, " + playerName + ". The correct answer was " + q.answers[q.correctAnswer] + ". " + (q.explanation || ""), "incorrect");
    $("question-timer").classList.remove("urgent");
    $("next-question").hidden = currentMatch.cashBuilder.completed;
    $("next-question").disabled = currentMatch.cashBuilder.completed;
    $("advance-after-cash").hidden = !currentMatch.cashBuilder.completed;
    renderBanks();
    $("current-bank").textContent = money(engine.totalBank(currentMatch));
    $("active-player").textContent = currentMatch.cashBuilder.completed ? "ROUND COMPLETE" : currentMatch.players[currentMatch.activePlayerIndex].name.toUpperCase();
    $("turn-number").textContent = String(currentMatch.turnNumber);
    if (currentMatch.cashBuilder.completed) {
      $("question-counter").textContent = "ALL QUESTIONS COMPLETE";
      $("question-text").textContent = "Cash Builder complete!";
      $("question-category").textContent = "ROUND COMPLETE";
      $("question-progress-fill").style.width = "100%";
      $("question-timer").textContent = "00";
      $("answer-grid").replaceChildren();
      setMessage("Cash Builder complete. Review the scores, then continue to Head-to-Head.");
    } else {
      setMessage("Answer recorded. " + currentMatch.players[currentMatch.activePlayerIndex].name + " is next.");
      $("question-counter").textContent = "QUESTION " + (currentMatch.cashBuilder.currentQuestionIndex + 1) + " OF " + currentMatch.cashBuilder.totalQuestions;
      $("question-progress-fill").style.width = (currentMatch.cashBuilder.currentQuestionIndex / currentMatch.cashBuilder.totalQuestions * 100) + "%";
    }
    $("next-question").hidden = currentMatch.cashBuilder.completed;
    $("next-question").disabled = currentMatch.cashBuilder.completed;
    pendingFeedback = null;
  }
  function continueQuestion() {
    if (!currentMatch || !currentMatch.cashBuilder || currentMatch.cashBuilder.completed) return;
    questionLocked = false;
    currentMatch.cashBuilder.secondsRemaining = currentMatch.cashBuilder.secondsPerQuestion;
    setSaveStatus(false);
    render();
    setFeedback(currentMatch.players[currentMatch.activePlayerIndex].name + ", your turn. Choose an answer before time runs out.");
    startTimer();
  }

  function chaseBankFor(playerIndex) {
    return currentMatch.mode === "cooperative" ? currentMatch.teamBank : currentMatch.players[playerIndex].bank;
  }
  let chaserTimer = null;
  function chaserAccuracy() {
    return ({ easy: 0.58, medium: 0.76, hard: 0.90 })[currentMatch.chaser] || 0.76;
  }
  function runChaserTurn() {
    const chase = currentMatch && currentMatch.headToHead;
    if (!chase || chase.status !== "active" || chase.turnStage !== "chaser") return;
    const qid = chase.questionIds[chase.questionIndex];
    const q = bank.find(item => item.id === qid);
    $("chase-question-count").textContent = "THE CHASER IS ANSWERING";
    $("chase-question-category").textContent = q ? q.category.toUpperCase() : "CHASER TURN";
    $("chase-question-text").textContent = q ? q.question : "The Chaser is considering the question...";
    $("chase-answer-grid").replaceChildren();
    $("chase-feedback").textContent = "The Chaser is thinking...";
    chaserTimer = setTimeout(() => {
      if (!currentMatch || !currentMatch.headToHead || currentMatch.headToHead.status !== "active") return;
      const correct = Math.random() < chaserAccuracy();
      const wrongChoices = q ? q.answers.map((_,i)=>i).filter(i=>i!==q.correctAnswer) : [];
      const chosenIndex = correct ? q.correctAnswer : (wrongChoices[Math.floor(Math.random()*wrongChoices.length)] ?? 0);
      const answerText = q ? q.answers[chosenIndex] : "No answer";
      const correctText = q ? q.answers[q.correctAnswer] : "Unknown";
      $("chase-question-text").textContent = q ? q.question : "The Chaser is considering the question...";
      $("chase-feedback").textContent = "THE CHASER'S ANSWER: " + answerText +
        (correct ? " · CORRECT!" : " · INCORRECT. THE ANSWER: " + correctText) +
        "  The board is about to move...";
      playSound(correct ? "chaser" : "wrong");
      commentary(correct ? "chaser_correct" : "chaser_wrong");
      const contestantCorrect = currentMatch.headToHead.pendingContestantCorrect;
      const contestantAnswerIndex = currentMatch.headToHead.pendingContestantAnswerIndex;
      currentMatch = engine.resolveHeadToHeadTurn(currentMatch, contestantCorrect, correct);
      const contestantAnswer = q && Number.isInteger(contestantAnswerIndex) ? q.answers[contestantAnswerIndex] : "No answer";
      const correctAnswer = q ? q.answers[q.correctAnswer] : "Unknown";
      $("chase-feedback").textContent = "SAME QUESTION · " +
        (contestantCorrect ? "CONTESTANT CORRECT" : "CONTESTANT INCORRECT") + " (" + contestantAnswer + ") · " +
        (correct ? "CHASER CORRECT" : "CHASER INCORRECT") + " (" + answerText + ") · CORRECT ANSWER: " + correctAnswer;
      if (currentMatch.headToHead.status === "active" && Math.abs(currentMatch.headToHead.contestantPosition - currentMatch.headToHead.chaserPosition) <= 1) commentary("close");
      currentMatch.headToHead.turnStage = "chaser_reveal";
      setSaveStatus(false);
      renderChaseBoard();
      if(correct) animateElement("chase-board","chaser-board-lunge");
      chaserTimer = setTimeout(() => {
        if (!currentMatch || !currentMatch.headToHead) return;
        currentMatch.headToHead.turnStage = currentMatch.headToHead.status === "active" ? "contestant" : "complete";
        $("chase-feedback").textContent = currentMatch.headToHead.status === "active"
          ? "Both answers are locked in. Next question — stay ahead of the Chaser!"
          : currentMatch.headToHead.status === "won" ? "The contestant has reached HOME and secured the prize!" : "The Chaser has caught the contestant!";
        renderChaseBoard();
      }, 1550);
    }, 1450);
  }
  function renderChaseBoard() {
    const panel = $("head-to-head-panel");
    const chase = currentMatch.headToHead;
    panel.hidden = currentMatch.phase !== "head_to_head";
    $("cash-builder-title").closest(".cash-builder").hidden = currentMatch.phase !== "cash_builder";
    if (currentMatch.phase !== "head_to_head") return;
    const playerIndex = chase ? chase.playerIndex : currentMatch.activePlayerIndex;
    const amount = chaseBankFor(playerIndex);
    $("offer-low").textContent = money(Math.max(1000, amount - 5000));
    $("offer-standard").textContent = money(amount);
    $("offer-high").textContent = money(amount + 5000);
    document.querySelectorAll("[data-offer]").forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.offer === selectedOffer);
      btn.disabled = !!chase;
    });
    $("start-chase").disabled = !!chase;
    $("start-chase").hidden = !!chase;
    if (!chase) {
      $("chase-intro").textContent = currentMatch.players[playerIndex].name + ", choose your offer. A lower offer starts further ahead; a higher offer starts closer to the Chaser.";
      $("chase-question-text").textContent = "Choose an offer, then start your chase.";
      $("chase-answer-grid").replaceChildren();
      $("chaser-controls").hidden = true;
      $("finish-chase").hidden = true;
      $("chase-turn").textContent = "—";
      drawChaseTrack(2,0,7);
      return;
    }
    $("chase-intro").textContent = currentMatch.players[chase.playerIndex].name + " is on the chase. Reach HOME before the Chaser catches you.";
    $("chase-turn").textContent = String(chase.contestantTurns + chase.chaserTurns + 1);
    drawChaseTrack(chase.contestantPosition,chase.chaserPosition,chase.homePosition);
    const call=$("chase-broadcast-call");
    if(call) call.textContent=chase.status==="won"?"HOME! THE PRIZE IS SECURED":chase.status==="lost"?"CAUGHT! THE CHASER HAS MADE THE CATCH":
      chase.turnStage==="chaser"||chase.turnStage==="chaser_thinking"?"THE CHASER IS ON THE MOVE":
      chase.turnStage==="chaser_reveal"?"THE CHASER HAS LOCKED IN AN ANSWER":
      chase.turnStage==="contestant_reveal"?"THE CONTESTANT HAS MADE THEIR MOVE":"THE CONTESTANT IS IN CONTROL";
    $("finish-chase").hidden = chase.status === "active" || chase.turnStage === "chaser_reveal";
    $("finish-chase").textContent = chase.status === "won" ? "PRIZE SECURED · CONTINUE" : "CAUGHT · CONTINUE";
    $("start-chase").hidden = true;
    $("chaser-controls").hidden = true;
    if (chase.turnStage === "chaser_reveal") {
      const revealQuestion = bank.find(item => item.id === chase.lastResolvedQuestionId);
      $("chase-question-count").textContent = "BOTH ANSWERS REVEALED";
      $("chase-question-category").textContent = revealQuestion ? revealQuestion.category.toUpperCase() : "HEAD-TO-HEAD";
      $("chase-question-text").textContent = revealQuestion ? revealQuestion.question : "Question complete.";
      $("chase-answer-grid").replaceChildren();
      return;
    }
    if (chase.status !== "active") {
      $("chase-question-text").textContent = chase.status === "won" ? "HOME! The contestant has secured " + money(chase.securedAmount) + "." : "CAUGHT! The Chaser has caught the contestant. The offer is lost.";
      $("chase-answer-grid").replaceChildren();
      $("chase-feedback").textContent = chase.status === "won" ? "The prize is safe." : "No prize is secured on this chase.";
      $("finish-chase").hidden = false;
      return;
    }
    if (chase.turnStage === "chaser") { runChaserTurn(); return; }
    if (chase.turnStage === "chaser_thinking") { $("chase-question-count").textContent = "THE CHASER IS ANSWERING"; $("chase-question-text").textContent = "The Chaser is thinking..."; $("chase-answer-grid").replaceChildren(); return; }
    if (chase.turnStage === "contestant_reveal") { $("chase-question-count").textContent = "ANSWER REVEALED"; $("chase-answer-grid").replaceChildren(); return; }
    if (chase.turnStage === "contestant" && chase.questionIndex >= chase.questionIds.length) {
      const nextQuestion = selectQuestionIds(1)[0];
      if (nextQuestion) chase.questionIds.push(nextQuestion);
    }
    const q = bank.find(item => item.id === chase.questionIds[chase.questionIndex]);
    $("chase-question-count").textContent = "CONTESTANT QUESTION " + (chase.contestantTurns + 1);
    $("chase-question-category").textContent = q ? q.category.toUpperCase() : "HEAD-TO-HEAD";
    $("chase-question-text").textContent = q ? q.question : "No more questions are available.";
    const grid = $("chase-answer-grid"); grid.replaceChildren();
    if (q) q.answers.forEach((answer,i) => {
      const btn=document.createElement("button"); btn.className="answer-option";
      const letter=document.createElement("span"); letter.className="answer-letter"; letter.textContent=String.fromCharCode(65+i);
      const label=document.createElement("span"); label.className="answer-label"; label.textContent=answer;
      btn.append(letter,label);
      btn.addEventListener("click",()=>{
        if (chase.turnStage !== "contestant") return;
        grid.querySelectorAll("button").forEach(x=>x.disabled=true);
        const correct=i===q.correctAnswer;
        currentMatch.headToHead.pendingContestantCorrect = correct;
        currentMatch.headToHead.pendingContestantAnswerIndex = i;
        playSound(correct ? "correct" : "wrong"); animateElement("chase-board","board-impact");
        currentMatch.headToHead.turnStage = "contestant_reveal";
        $("chase-question-text").textContent = q.question;
        $("chase-feedback").textContent=(correct ? "CONTESTANT LOCKED IN: CORRECT" : "CONTESTANT LOCKED IN: INCORRECT") +
          " · " + q.answers[i] + ". The Chaser must now answer this same question.";
        setSaveStatus(false);
        renderChaseBoard();
        chaserTimer = setTimeout(() => {
          if (!currentMatch || !currentMatch.headToHead || currentMatch.headToHead.status !== "active") return;
          currentMatch.headToHead.turnStage = "chaser";
          renderChaseBoard();
        }, 1050);
      });
      grid.append(btn);
    });
  }
  function drawChaseTrack(contestant,chaser,home) {
    const board=$("chase-board"); board.replaceChildren();
    for(let i=0;i<=home;i++){
      const cell=document.createElement("div");
      cell.className="chase-space"+(i===home?" home":"")+(i===contestant?" contestant":"")+(i===chaser?" chaser":"")+(i===contestant&&i===chaser?" both":"");
      const label=document.createElement("span"); label.textContent=i===home?"HOME":i===0?"START":String(i).padStart(2,"0");
      cell.append(label);
      if(i===contestant){
        const token=document.createElement("div");token.className="chase-character contestant-character";
        const sprite=document.createElement("img");sprite.src="assets/sprites/contestant-blue.svg";
        const avatarPlayer=currentMatch.headToHead?currentMatch.headToHead.playerIndex:currentMatch.activePlayerIndex;
        sprite.alt=currentMatch.players[avatarPlayer].name;
        const caption=document.createElement("span");caption.textContent="CONTESTANT";
        token.append(sprite,caption);cell.append(token);
      }
      if(i===chaser){
        const token=document.createElement("div");token.className="chase-character chaser-character";
        const sprite=document.createElement("img");sprite.src="assets/sprites/chaser-red.svg";sprite.alt="The Chaser";
        const caption=document.createElement("span");caption.textContent="THE CHASER";
        token.append(sprite,caption);cell.append(token);
      }
      board.append(cell);
    }
  }
  function startSelectedChase() {
    const playerIndex=currentMatch.activePlayerIndex;
    const amount=chaseBankFor(playerIndex);
    const qs=selectQuestionIds(1);
    currentMatch=engine.beginHeadToHead(currentMatch,playerIndex,selectedOffer,amount,qs);
    playSound("start"); animateElement("chase-board","board-impact");
    setSaveStatus(false);
    renderChaseBoard();
    $("chase-feedback").textContent="Answer your question. The Chaser will automatically take its turn.";
  }
  function finishChase() {
    commentary(currentMatch.headToHead.status === "won" ? "escape" : "caught");
    currentMatch=engine.completeHeadToHead(currentMatch);
    currentMatch.players[currentMatch.headToHead.playerIndex].chaseComplete=true;
    if(currentMatch.players.every(p=>p.chaseComplete)){
      currentMatch=engine.advancePhase(currentMatch);
      $("chase-feedback").textContent="Both contestants have completed their chases. Final Chase is the next round.";
    } else {
      currentMatch.activePlayerIndex=currentMatch.headToHead.playerIndex===0?1:0;
      delete currentMatch.headToHead;
      $("chase-feedback").textContent=currentMatch.players[currentMatch.activePlayerIndex].name+" is next to choose an offer.";
    }
    setSaveStatus(false);
    render();
    renderChaseBoard();
  }


  let finalTimerHandle = null, finalAiHandle = null;
  function finalQuestions() {
    return selectQuestionIds(30);
  }
  function renderFinalRace(fc) {
    const track=$("final-race-track");
    if(!track)return;
    const target=Math.max(2,fc.contestantScore+fc.chaserHeadStart);
    const width=Math.min(20,Math.max(2,target));
    track.style.gridTemplateColumns="repeat("+(width+1)+", minmax(0,1fr))";
    track.replaceChildren();
    for(let i=0;i<=width;i++){
      const cell=document.createElement("span");
      cell.className="final-race-cell"+(i===width?" finish":"")+(i===Math.min(width,fc.chaserScore)?" chaser-here":"");
      if(i===width){
        const team=document.createElement("img");team.src="assets/sprites/team-duo.svg";team.alt="The contestants";team.className="race-team-sprite";
        const home=document.createElement("small");home.textContent="HOME";cell.append(team,home);
      } else if(i===Math.min(width,fc.chaserScore) && fc.stage==="chaser"){
        const chaser=document.createElement("img");chaser.src="assets/sprites/chaser-red.svg";chaser.alt="The Chaser";chaser.className="race-chaser-sprite";
        cell.append(chaser);
      } else {
        cell.textContent=String(i).padStart(2,"0");
      }
      track.append(cell);
    }
    const status=fc.completed
      ? (fc.outcome==="contestants_win"?"THE TEAM ESCAPED!":"THE CHASER CAUGHT THEM!")
      : (fc.stage==="chaser"?"CHASER "+fc.chaserScore+" / "+target:(fc.stage==="ready"?"READY TO SET THE TARGET":"TEAM BUILDING A LEAD · TARGET "+target));
    $("final-race-status").textContent=status;
    track.style.setProperty("--chaser-progress",Math.min(100,(fc.chaserScore/target)*100)+"%");
  }
  function renderFinalChase() {
    const panel=$("final-chase-panel"), fc=currentMatch.finalChase;
    panel.hidden=currentMatch.phase!=="final_chase" && currentMatch.phase!=="results";
    if (!fc) return;
    $("final-contestant-score").textContent=String(fc.contestantScore);
    $("final-chaser-score").textContent=String(fc.chaserScore);
    $("final-target").textContent=String(fc.contestantScore+fc.chaserHeadStart);
    $("final-timer").textContent=String(fc.secondsRemaining);
    renderFinalRace(fc);
    $("final-stage-label").textContent=fc.stage==="contestants"?"TEAM TIME":"CHASER TIME";
    const broadcast=$("final-broadcast-call");
    if(broadcast) broadcast.textContent=fc.completed
      ? (fc.outcome==="contestants_win"?"THE TEAM HAS BEATEN THE CHASER!":"THE CHASER HAS CAUGHT THE TEAM!")
      : fc.stage==="ready"?"THE TEAM SETS THE TARGET"
      : fc.stage==="contestants"?"THE TEAM IS BUILDING ITS LEAD"
      : fc.showingChaserReveal?"THE CHASER HAS LOCKED IN AN ANSWER":"THE CHASER IS CLOSING IN";
    $("start-final-chase").hidden=fc.stage!=="ready";
    $("pushback-choice").disabled=fc.stage!=="ready";
    if(fc.completed){
      $("final-question-text").textContent=fc.outcome==="contestants_win"?"THE CONTESTANTS WIN! You have beaten the Chaser!":"THE CHASER WINS! The Chaser has caught the team.";
      $("final-broadcast-banner").classList.toggle("banner-win",fc.outcome==="contestants_win");
      $("final-broadcast-banner").classList.toggle("banner-loss",fc.outcome!=="contestants_win");
      if (!finalResultAnnounced) { playSound(fc.outcome==="contestants_win"?"win":"lose"); animateElement("final-question-text","result-reveal"); finalResultAnnounced=true; }
      $("final-feedback").textContent="Final score: Contestants "+fc.contestantScore+" · Chaser "+fc.chaserScore+"."+
        (fc.lastChaserReveal ? " Last Chaser answer: "+fc.lastChaserReveal.answer+
          (fc.lastChaserReveal.correct ? " (correct)." : " (incorrect; correct answer: "+fc.lastChaserReveal.correctAnswer+").") : "");
      $("final-answer-grid").replaceChildren();
      $("finish-match").hidden=false;
      return;
    }
    if(fc.stage==="contestants"){
      const q=bank.find(x=>x.id===fc.questionIds[fc.contestantIndex]);
      $("final-question-count").textContent="TEAM QUESTION "+(fc.contestantIndex+1)+" OF 15";
      $("final-question-category").textContent=q?q.category.toUpperCase():"FINAL CHASE";
      $("final-question-text").textContent=q?q.question:"The team has completed its questions.";
      renderFinalAnswers(q,"contestants");
    } else if(fc.stage==="chaser"){
      if(fc.showingChaserReveal && fc.lastChaserReveal){
        $("final-question-count").textContent="CHASER ANSWER REVEALED";
        $("final-question-category").textContent=String(fc.lastChaserReveal.category||"CHASER").toUpperCase();
        $("final-question-text").textContent=fc.lastChaserReveal.question;
      }else{
        $("final-question-count").textContent="THE CHASER IS ANSWERING";
        $("final-question-category").textContent="CPU OPPONENT";
        $("final-question-text").textContent="The Chaser is considering the next question...";
      }
      $("final-answer-grid").replaceChildren();
    }
  }
  function renderFinalAnswers(q,stage){
    const grid=$("final-answer-grid");grid.replaceChildren();
    if(!q)return;
    q.answers.forEach((answer,i)=>{
      const b=document.createElement("button");b.className="answer-option";
      const letter=document.createElement("span");letter.className="answer-letter";letter.textContent=String.fromCharCode(65+i);
      const label=document.createElement("span");label.className="answer-label";label.textContent=answer;b.append(letter,label);
      b.addEventListener("click",()=>submitFinalAnswer(i,q));grid.append(b);
    });
  }
  function stopFinalTimers(){
    if(finalTimerHandle)clearInterval(finalTimerHandle);
    if(finalAiHandle)clearTimeout(finalAiHandle);
    finalTimerHandle=null;finalAiHandle=null;
  }
  function startFinalTimer(){
    if(finalTimerHandle)clearInterval(finalTimerHandle);
    finalTimerHandle=setInterval(()=>{
      const fc=currentMatch.finalChase;
      if(!fc||fc.completed){stopFinalTimers();return;}
      fc.secondsRemaining=Math.max(0,fc.secondsRemaining-1);
      $("final-timer").textContent=String(fc.secondsRemaining);
      if(fc.secondsRemaining<=10) { $("final-timer").classList.add("urgent"); playSound("tick"); }
      if(fc.secondsRemaining===0){
        if(fc.stage==="contestants"){fc.stage="chaser";fc.secondsRemaining=fc.secondsPerSide;beginFinalChaser();}
        else finishFinalByTimer();
      }
    },1000);
  }
  function submitFinalAnswer(index,q){
    const fc=currentMatch.finalChase;
    if(!fc||fc.stage!=="contestants")return;
    const correct=index===q.correctAnswer;
    currentMatch=engine.resolveFinalChaseContestant(currentMatch,correct);
    $("final-feedback").textContent=(correct?"TEAM ANSWER: "+q.answers[index]+" · CORRECT. ":"TEAM ANSWER: "+q.answers[index]+" · NOT QUITE. CORRECT ANSWER: "+q.answers[q.correctAnswer]+". ") +
      (correct?"The team adds a point.":"No point this time.");
    setSaveStatus(false);
    renderFinalChase();
    if(currentMatch.finalChase.stage==="chaser") {
      finalAiHandle=setTimeout(beginFinalChaser, 1100);
    } else {
      finalAiHandle=setTimeout(() => {
        if (currentMatch && currentMatch.finalChase && !currentMatch.finalChase.completed) renderFinalChase();
      }, 950);
    }
  }
  function beginFinalChaser(){
    stopFinalTimers();
    const fc=currentMatch.finalChase;
    if(!fc||fc.stage!=="chaser")return;
    playSound("reveal"); animateElement("final-chase-title","studio-reveal");
    $("final-feedback").textContent="The team scored "+fc.contestantScore+". The Chaser now has 60 seconds and must catch that score plus "+fc.chaserHeadStart+".";
    renderFinalChase();startFinalTimer();runFinalChaserTurn();
  }
  function runFinalChaserTurn(){
    const fc=currentMatch.finalChase;
    if(!fc||fc.completed||fc.stage!=="chaser")return;
    fc.showingChaserReveal=false;
    if(fc.chaserIndex>=30){finishFinalByTimer();return;}
    const q=bank.find(x=>x.id===fc.questionIds[fc.chaserIndex]);
    $("final-question-count").textContent="CHASER QUESTION "+(fc.chaserIndex-14)+" OF 15";
    $("final-question-category").textContent=q?q.category.toUpperCase():"CHASER";
    $("final-question-text").textContent=q?q.question:"The Chaser is answering...";
    finalAiHandle=setTimeout(()=>{
      if(!currentMatch||!currentMatch.finalChase||currentMatch.finalChase.completed)return;
      const chosenCorrect=Math.random()<chaserAccuracy();
      commentary(chosenCorrect ? "chaser_correct" : "chaser_wrong");
      const wrongChoices=q ? q.answers.map((_,i)=>i).filter(i=>i!==q.correctAnswer) : [];
      const chosenIndex=chosenCorrect?q.correctAnswer:(wrongChoices[Math.floor(Math.random()*wrongChoices.length)] ?? 0);
      const chaserAnswer=q?q.answers[chosenIndex]:"No answer";
      const correctAnswer=q?q.answers[q.correctAnswer]:"Unknown";
      currentMatch.finalChase.chaserIndex++;
      const f=currentMatch.finalChase;
      if(chosenCorrect)f.chaserScore++;
      const caught=f.chaserScore>=f.contestantScore+f.chaserHeadStart;
      const exhausted=f.chaserIndex>=30;
      f.lastChaserReveal={questionId:q?q.id:null,question:q?q.question:"",category:q?q.category:"CHASER",answer:chaserAnswer,correct:chosenCorrect,correctAnswer};
      f.showingChaserReveal=true;
      if(caught||exhausted){
        f.completed=true;f.outcome=caught?"chaser_wins":"contestants_win";currentMatch.phase="results";currentMatch.status="completed";
      }
      playSound(chosenCorrect?"chaser":"wrong");
      if(chosenCorrect){animateElement("final-chaser-score","score-bump");animateElement("final-race-track","chaser-lunge");}
      if(caught)animateElement("final-broadcast-banner","final-caught");
      $("final-question-text").textContent=q?q.question:"The Chaser has answered.";
      $("final-question-count").textContent="CHASER QUESTION "+(f.chaserIndex-15)+" OF 15";
      $("final-feedback").textContent="THE CHASER ANSWERED: "+chaserAnswer+
        (chosenCorrect?" · CORRECT. The Chaser scores a point.":" · INCORRECT. The correct answer was "+correctAnswer+". The Chaser scores nothing.")+
        (caught?" THE CHASER HAS CAUGHT THE TEAM!":(exhausted?" TIME / QUESTIONS EXHAUSTED. THE TEAM SURVIVES!":""));
      setSaveStatus(false);renderFinalChase();
      if(!f.completed) {
        finalAiHandle=setTimeout(runFinalChaserTurn, 1250);
      } else {
        stopFinalTimers();
        playSound(f.outcome==="contestants_win"?"win":"lose");
        animateElement("final-chase-panel","result-reveal");
        animateElement("final-broadcast-banner",f.outcome==="contestants_win"?"final-escape":"final-caught");
      }
    },1500);
  }
  function finishFinalByTimer(){
    const fc=currentMatch.finalChase;
    if(!fc||fc.completed)return;
    fc.completed=true;fc.outcome=fc.chaserScore>=fc.contestantScore+fc.chaserHeadStart?"chaser_wins":"contestants_win";
    commentary(fc.outcome === "contestants_win" ? "win" : "lose");
    currentMatch.phase="results";currentMatch.status="completed";
    stopFinalTimers();renderFinalChase();setSaveStatus(false);
  }
  function startFinalChase(){
    const ids=finalQuestions();
    if(ids.length<30){setFeedback("Not enough questions for the Final Chase.","error");return;}
    currentMatch=engine.beginFinalChase(currentMatch,ids,Number($("pushback-choice").value),60);
    currentMatch.finalChase.stage="contestants";
    setSaveStatus(false);renderFinalChase();startFinalTimer();
    $("final-feedback").textContent="Work together. Each correct answer adds one point. You have 60 seconds.";
  }

  function downloadJson() {
    const blob = new Blob([engine.exportJson(currentMatch)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "chase-match-" + currentMatch.matchId + ".json";
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setMessage("Match data exported as JSON.");
  }

  $("sound-toggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    syncSoundButton();
    if (soundEnabled) playSound("start");
  });
  syncSoundButton();

  window.addEventListener("chase:matchcreated", (event) => {
    stopTimer();
    currentMatch = engine.createMatch(event.detail);
    currentMatch.chaserPersonality = event.detail.chaserPersonality || "professor";
    currentMatch.presenterStyle = event.detail.presenterStyle || "warm";
    lastAnnouncedPhase = null; lastAnnouncedPlayer = null;
    createQuestionDeck();
    finalResultAnnounced = false;
    setSaveStatus(false, "NEW MATCH");
    questionLocked = false;
    setFeedback("When both contestants are ready, start the Cash Builder.");
    setMessage("New " + currentMatch.mode + " match created. " + currentMatch.players[0].name + " takes the first turn.");
    render();
    showStudioIntro(currentMatch);
  });
  $("dismiss-studio-intro").addEventListener("click", hideStudioIntro);
  window.addEventListener("chase:screenchange", event => { if (event.detail && event.detail.screen === "home" && window.ChaseFamilyRecords) window.ChaseFamilyRecords.renderDashboard(); });
  $("studio-intro").addEventListener("click", (event) => { if (event.target === $("studio-intro")) hideStudioIntro(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("studio-intro").hidden) hideStudioIntro();
  });
  $("start-cash-builder").addEventListener("click", beginCashBuilder);
  $("next-question").addEventListener("click", continueQuestion);
  $("advance-after-cash").addEventListener("click", () => {
    stopTimer();
    currentMatch = engine.advancePhase(currentMatch);
    lastAnnouncedPlayer = null;
    setSaveStatus(false);
    setMessage("Cash Builder complete. Choose an offer and take on the Chaser.");
    setFeedback("Your Cash Builder total determines the standard offer. You can also choose a lower or higher offer.");
    render();
    renderChaseBoard();
  });

  document.querySelectorAll("[data-offer]").forEach(b=>b.addEventListener("click",()=>{
    selectedOffer=b.dataset.offer;
    document.querySelectorAll("[data-offer]").forEach(x=>x.classList.toggle("selected",x===b));
  }));
  $("start-chase").addEventListener("click",startSelectedChase);
  $("start-final-chase").addEventListener("click",startFinalChase);
  $("finish-match").addEventListener("click",()=>{
    const result = window.ChaseFamilyRecords ? window.ChaseFamilyRecords.recordMatch(currentMatch) : { recorded:false };
    const outcome = currentMatch.finalChase.outcome==="contestants_win"?"The contestants beat the Chaser!":"The Chaser wins this match.";
    const unlocked = result.participants ? result.participants.flatMap(p=>p.newAchievements).length : 0;
    $("final-feedback").textContent = "Match complete. " + outcome + (result.recorded ? " Family records updated." : result.duplicate ? " This match is already in the family records." : " Family records could not be updated.") + (unlocked ? " " + unlocked + " new achievement" + (unlocked===1?"":"s") + " unlocked!" : "");
    $("finish-match").disabled=true;
    playSound(currentMatch.finalChase.outcome==="contestants_win"?"win":"lose");
    animateElement("final-chase-panel","result-reveal");
  });
  $("reset-family-records").addEventListener("click",()=>{ if(window.ChaseFamilyRecords) window.ChaseFamilyRecords.reset(); });
  $("finish-chase").addEventListener("click",finishChase);

  $("save-match").addEventListener("click", () => {
    try { engine.save(currentMatch); setSaveStatus(true); setMessage("Match saved in this browser on this device."); }
    catch (error) { setMessage("Could not save match: " + error.message); }
  });
  $("load-match").addEventListener("click", () => {
    try {
      const loaded = engine.load();
      if (!loaded) { setMessage("No saved match was found in this browser."); return; }
      stopTimer();
      currentMatch = loaded;
      currentMatch.chaserPersonality = currentMatch.chaserPersonality || "professor";
      currentMatch.presenterStyle = currentMatch.presenterStyle || "warm";
      questionLocked = false;
      setSaveStatus(true);
      setMessage("Saved match restored. Last updated " + new Date(loaded.updatedAt).toLocaleString("en-AU") + ".");
      render();
      if (currentMatch.finalChase && !currentMatch.finalChase.completed) {
        setFeedback("Final Chase restored. The round will continue from its saved state.");
        startFinalTimer();
        if (currentMatch.finalChase.stage === "chaser") runFinalChaserTurn();
      }
      if (currentMatch.cashBuilder && !currentMatch.cashBuilder.completed) {
        currentMatch.cashBuilder.secondsRemaining = Math.max(1, currentMatch.cashBuilder.secondsRemaining || QUESTION_SECONDS);
        setFeedback("Saved question restored. " + currentMatch.players[currentMatch.activePlayerIndex].name + " can continue.");
        startTimer();
      }
    } catch (error) { setMessage("Could not load saved match: " + error.message); }
  });
  $("export-match").addEventListener("click", () => {
    if (!currentMatch) { setMessage("Start a match before exporting."); return; }
    downloadJson();
  });
  $("reset-match").addEventListener("click", () => {
    if (!currentMatch) return;
    stopTimer();
    const config = { mode: currentMatch.mode, players: currentMatch.players.map(p => p.name), difficulty: currentMatch.difficulty, chaser: currentMatch.chaser, categories: currentMatch.categories, length: currentMatch.length };
    currentMatch = engine.createMatch(config);
    lastAnnouncedPhase = null; lastAnnouncedPlayer = null;
    finalResultAnnounced = false;
    engine.removeSaved();
    questionLocked = false;
    setSaveStatus(false, "RESET");
    setFeedback("Match reset. Start the Cash Builder when ready.");
    setMessage("Match reset. Scores and turn history have been cleared.");
    render();
  });

  window.ChaseGame.status = () => ({ version: window.ChaseGame.config.version, match: currentMatch, saved: saved });
})();
