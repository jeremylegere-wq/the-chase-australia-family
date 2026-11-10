/* M2: deterministic match-state engine with local persistence.
   Trivia delivery and automatic round rules are intentionally deferred to M3+. */
(function () {
  "use strict";
  const STORAGE_KEY = "the-chase-australia-family.match.v1";
  const SCHEMA_VERSION = 1;
  const PHASES = ["cash_builder", "head_to_head", "final_chase", "results"];
  const PHASE_LABELS = {
    cash_builder: "Cash Builder",
    head_to_head: "Head-to-Head",
    final_chase: "Final Chase",
    results: "Results"
  };
  const STARTING_CASH = 0;
  const CORRECT_ANSWER_VALUE = 1000;

  function makePlayer(name, index) {
    return {
      id: "player-" + (index + 1),
      name: String(name || ("Player " + (index + 1))).trim().slice(0, 16),
      bank: STARTING_CASH,
      correctAnswers: 0,
      incorrectAnswers: 0,
      turnsTaken: 0,
      contribution: 0,
      securedPrize: 0,
      chaseComplete: false
    };
  }

  function createMatch(config) {
    const players = (config.players || ["Player 1", "Player 2"]).slice(0, 2).map(makePlayer);
    return {
      schemaVersion: SCHEMA_VERSION,
      matchId: "chase-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mode: config.mode === "competitive" ? "competitive" : "cooperative",
      difficulty: config.difficulty || "family",
      chaser: config.chaser || "medium",
      categories: config.categories || "mixed",
      length: config.length || "standard",
      phase: "cash_builder",
      activePlayerIndex: 0,
      turnNumber: 1,
      teamBank: STARTING_CASH,
      players: players,
      history: [{ type: "match_created", at: new Date().toISOString(), detail: "New " + (config.mode || "cooperative") + " match." }],
      status: "in_progress"
    };
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stamp(match) { match.updatedAt = new Date().toISOString(); return match; }
  function activePlayer(match) { return match.players[match.activePlayerIndex]; }
  function totalBank(match) {
    return match.mode === "cooperative"
      ? match.teamBank
      : match.players.reduce((sum, player) => sum + player.bank, 0);
  }
  function addHistory(match, type, detail) {
    match.history.push({ type: type, at: new Date().toISOString(), detail: detail });
    if (match.history.length > 250) match.history = match.history.slice(-250);
  }
  function assertMatch(match) {
    if (!match || match.schemaVersion !== SCHEMA_VERSION) throw new Error("Unsupported or invalid saved match version.");
    if (!["cooperative", "competitive"].includes(match.mode)) throw new Error("Saved match has an invalid game mode.");
    if (!PHASES.includes(match.phase)) throw new Error("Saved match has an invalid phase.");
    if (!Array.isArray(match.players) || match.players.length !== 2) throw new Error("A match must contain exactly two players.");
    if (!Number.isInteger(match.activePlayerIndex) || match.activePlayerIndex < 0 || match.activePlayerIndex > 1) throw new Error("Saved match has an invalid active player.");
    for (const player of match.players) {
      if (!Number.isFinite(player.bank) || player.bank < 0) throw new Error("Saved match contains an invalid player bank.");
    }
    if (!Number.isFinite(match.teamBank) || match.teamBank < 0) throw new Error("Saved match contains an invalid team bank.");
    return true;
  }

  function applyAnswer(match, correct) {
    const next = clone(match);
    if (next.status !== "in_progress") throw new Error("This match has finished. Reset or start a new match to continue.");
    if (next.phase !== "cash_builder") throw new Error("M2 answer scoring is currently enabled only for the Cash Builder foundation.");
    const player = activePlayer(next);
    player.turnsTaken += 1;
    if (correct) {
      player.correctAnswers += 1;
      player.contribution += CORRECT_ANSWER_VALUE;
      if (next.mode === "cooperative") next.teamBank += CORRECT_ANSWER_VALUE;
      else player.bank += CORRECT_ANSWER_VALUE;
      addHistory(next, "answer_correct", player.name + " scored $" + CORRECT_ANSWER_VALUE.toLocaleString("en-AU") + ".");
    } else {
      player.incorrectAnswers += 1;
      addHistory(next, "answer_incorrect", player.name + " recorded an incorrect answer.");
    }
    next.turnNumber += 1;
    next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
    return stamp(next);
  }

  function nextPlayer(match) {
    const next = clone(match);
    if (next.status !== "in_progress") throw new Error("This match has finished.");
    next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
    next.turnNumber += 1;
    addHistory(next, "turn_changed", "Turn passed to " + activePlayer(next).name + ".");
    return stamp(next);
  }

  function advancePhase(match) {
    const next = clone(match);
    if (next.status !== "in_progress") throw new Error("This match has finished.");
    const index = PHASES.indexOf(next.phase);
    if (index >= PHASES.length - 1) {
      next.status = "completed";
      addHistory(next, "match_completed", "Match marked complete from the results phase.");
    } else {
      next.phase = PHASES[index + 1];
      next.activePlayerIndex = 0;
      next.turnNumber = 1;
      addHistory(next, "phase_changed", "Advanced to " + PHASE_LABELS[next.phase] + ".");
    }
    return stamp(next);
  }


  function beginCashBuilder(match, questionIds, questionsPerPlayer, secondsPerQuestion) {
    const next = clone(match);
    if (next.status !== "in_progress" || next.phase !== "cash_builder") throw new Error("Cash Builder cannot be started in the current match state.");
    if (!Array.isArray(questionIds) || questionIds.length < questionsPerPlayer * 2) throw new Error("Not enough eligible questions for both players.");
    next.cashBuilder = {
      questionsPerPlayer: questionsPerPlayer,
      totalQuestions: questionsPerPlayer * 2,
      questionIds: questionIds.slice(0, questionsPerPlayer * 2),
      currentQuestionIndex: 0,
      secondsPerQuestion: secondsPerQuestion,
      secondsRemaining: secondsPerQuestion,
      completed: false
    };
    next.activePlayerIndex = 0;
    next.turnNumber = 1;
    addHistory(next, "cash_builder_started", "Cash Builder started with " + questionsPerPlayer + " questions per player.");
    return stamp(next);
  }

  function resolveCashBuilderAnswer(match, correct, timedOut) {
    const next = clone(match);
    if (!next.cashBuilder || next.cashBuilder.completed) throw new Error("There is no active Cash Builder question.");
    if (next.status !== "in_progress" || next.phase !== "cash_builder") throw new Error("Cash Builder is not active.");
    const player = activePlayer(next);
    player.turnsTaken += 1;
    if (correct && !timedOut) {
      player.correctAnswers += 1;
      player.contribution += CORRECT_ANSWER_VALUE;
      if (next.mode === "cooperative") next.teamBank += CORRECT_ANSWER_VALUE;
      else player.bank += CORRECT_ANSWER_VALUE;
      addHistory(next, "answer_correct", player.name + " answered correctly and scored $" + CORRECT_ANSWER_VALUE.toLocaleString("en-AU") + ".");
    } else {
      player.incorrectAnswers += 1;
      addHistory(next, timedOut ? "answer_timeout" : "answer_incorrect", player.name + (timedOut ? " ran out of time." : " answered incorrectly."));
    }
    next.cashBuilder.currentQuestionIndex += 1;
    if (next.cashBuilder.currentQuestionIndex >= next.cashBuilder.totalQuestions) {
      next.cashBuilder.completed = true;
      next.cashBuilder.secondsRemaining = 0;
      addHistory(next, "cash_builder_completed", "Both contestants completed their Cash Builder questions.");
    } else {
      next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
      next.turnNumber += 1;
      next.cashBuilder.secondsRemaining = next.cashBuilder.secondsPerQuestion;
    }
    return stamp(next);
  }

  function setCashBuilderRemaining(match, seconds) {
    const next = clone(match);
    if (!next.cashBuilder || next.cashBuilder.completed) return next;
    next.cashBuilder.secondsRemaining = Math.max(0, Math.floor(seconds));
    return stamp(next);
  }


  const CHASE_OFFERS = {
    low: { label: "LOWER OFFER", amount: 1000, startPosition: 3 },
    standard: { label: "CASH BUILDER", amount: 0, startPosition: 2 },
    high: { label: "HIGHER OFFER", amount: 0, startPosition: 1 }
  };
  function beginHeadToHead(match, playerIndex, offer, cashBuilderAmount, questionIds) {
    const next = clone(match);
    if (next.phase !== "head_to_head" || next.status !== "in_progress") throw new Error("Head-to-Head is not ready.");
    if (![0,1].includes(playerIndex) || !CHASE_OFFERS[offer]) throw new Error("Invalid contestant or offer.");
    const amount = offer === "low" ? Math.max(1000, cashBuilderAmount - 5000) :
      offer === "high" ? cashBuilderAmount + 5000 : cashBuilderAmount;
    const selected = CHASE_OFFERS[offer];
    const startPosition = offer === "low" ? 3 : offer === "high" ? 1 : 2;
    next.headToHead = {
      playerIndex, offer, offerAmount: amount, startingPosition: startPosition,
      contestantPosition: startPosition, chaserPosition: 0, homePosition: 7,
      questionIds: questionIds.slice(0, 12), questionIndex: 0, turnStage: "contestant",
      pendingContestantCorrect: null, contestantTurns: 0, chaserTurns: 0, status: "active",
      securedAmount: 0, caught: false
    };
    next.activePlayerIndex = playerIndex;
    addHistory(next, "chase_started", next.players[playerIndex].name + " accepted " + selected.label + " for " + amount + ".");
    return stamp(next);
  }
  function resolveHeadToHeadTurn(match, contestantCorrect, chaserCorrect) {
    const next = clone(match);
    const chase = next.headToHead;
    if (!chase || chase.status !== "active") throw new Error("No active chase.");
    if (!Array.isArray(chase.questionIds) || !chase.questionIds.length || !chase.questionIds[chase.questionIndex]) throw new Error("No Head-to-Head question is available.");
    if (typeof contestantCorrect !== "boolean" || typeof chaserCorrect !== "boolean") throw new Error("Both sides must lock in an answer.");

    const contestant = next.players[chase.playerIndex];
    chase.lastResolvedQuestionId = chase.questionIds[chase.questionIndex];
    chase.contestantTurns += 1;
    chase.chaserTurns += 1;
    chase.questionIndex += 1;
    chase.pendingContestantCorrect = null;

    if (contestantCorrect) {
      contestant.correctAnswers += 1;
      chase.contestantPosition = Math.min(chase.homePosition, chase.contestantPosition + 1);
      addHistory(next, "contestant_moved", contestant.name + " answered the shared question correctly and moved one space.");
    } else {
      contestant.incorrectAnswers += 1;
      addHistory(next, "contestant_stayed", contestant.name + " answered the shared question incorrectly and stayed put.");
    }

    if (chaserCorrect) {
      chase.chaserPosition = Math.min(chase.homePosition, chase.chaserPosition + 1);
      addHistory(next, "chaser_moved", "The Chaser answered the same question correctly and moved one space.");
    } else {
      addHistory(next, "chaser_stayed", "The Chaser answered the shared question incorrectly and stayed put.");
    }

    // Resolve the board only after both answers have been applied. Reaching HOME
    // takes precedence when both sides move during the same question.
    if (chase.contestantPosition >= chase.homePosition) {
      chase.status = "won";
      chase.securedAmount = chase.offerAmount;
      addHistory(next, "chase_won", contestant.name + " reached home and secured " + chase.offerAmount + ".");
    } else if (chase.chaserPosition >= chase.contestantPosition) {
      chase.status = "caught";
      chase.caught = true;
      addHistory(next, "chase_caught", contestant.name + " was caught by the Chaser.");
    }
    return stamp(next);
  }
  // Retained for compatibility with older saved-game tooling. New gameplay
  // must use resolveHeadToHeadTurn so both answers resolve against one question.
  function resolveContestantChaseAnswer(match, correct) {
    const next = clone(match);
    if (!next.headToHead || next.headToHead.status !== "active") throw new Error("No active chase.");
    next.headToHead.pendingContestantCorrect = !!correct;
    return stamp(next);
  }
  function resolveChaserChaseAnswer(match, correct) {
    const chase = match && match.headToHead;
    if (!chase || typeof chase.pendingContestantCorrect !== "boolean") throw new Error("The contestant must answer the shared question first.");
    return resolveHeadToHeadTurn(match, chase.pendingContestantCorrect, !!correct);
  }
  function completeHeadToHead(match) {
    const next = clone(match);
    if (!next.headToHead || !["won","caught"].includes(next.headToHead.status)) throw new Error("The chase is not complete.");
    const chase = next.headToHead;
    const player = next.players[chase.playerIndex];
    if (chase.status === "won") {
      player.securedPrize = (player.securedPrize || 0) + chase.securedAmount;
      if (next.mode === "cooperative") next.teamSecuredPrize = Math.max(next.teamSecuredPrize || 0, chase.securedAmount);
    }
    addHistory(next, "chase_recorded", chase.status === "won" ? "Prize secured: " + chase.securedAmount : "Prize lost to the Chaser.");
    next.activePlayerIndex = (chase.playerIndex + 1) % 2;
    return stamp(next);
  }


  function beginFinalChase(match, questionIds, pushbacks, seconds) {
    const next = clone(match);
    if (next.phase !== "final_chase" || next.status !== "in_progress") throw new Error("Final Chase is not ready.");
    if (!Array.isArray(questionIds) || questionIds.length < 30) throw new Error("Not enough questions for the Final Chase.");
    const extra = Math.max(0, Math.min(3, Math.floor(pushbacks || 0)));
    next.finalChase = {
      questionIds: questionIds.slice(0, 30), contestantIndex: 0, chaserIndex: 15,
      contestantScore: 0, chaserScore: 0, pushbacks: extra,
      chaserHeadStart: 2 + extra, secondsPerSide: seconds || 60,
      secondsRemaining: seconds || 60, stage: "ready",
      completed: false, outcome: null, playerScores: [0,0]
    };
    addHistory(next, "final_chase_started", "Final Chase started with " + extra + " pushback(s).");
    return stamp(next);
  }
  function resolveFinalChaseContestant(match, correct) {
    const next = clone(match), fc = next.finalChase;
    if (!fc || fc.completed || fc.stage !== "contestants") throw new Error("Contestant Final Chase is not active.");
    const p = next.players[next.activePlayerIndex];
    if (correct) {
      fc.contestantScore += 1;
      fc.playerScores[next.activePlayerIndex] += 1;
      p.correctAnswers += 1;
    } else {
      p.incorrectAnswers += 1;
    }
    fc.contestantIndex += 1;
    next.activePlayerIndex = (next.activePlayerIndex + 1) % 2;
    fc.secondsRemaining = Math.max(0, fc.secondsRemaining);
    if (fc.contestantIndex >= 15 || fc.secondsRemaining <= 0) {
      fc.stage = "chaser"; fc.secondsRemaining = fc.secondsPerSide;
      addHistory(next, "final_chase_contestants_done", "Contestants scored " + fc.contestantScore + ".");
    }
    return stamp(next);
  }
  function resolveFinalChaseChaser(match, correct) {
    const next = clone(match), fc = next.finalChase;
    if (!fc || fc.completed || fc.stage !== "chaser") throw new Error("Chaser Final Chase is not active.");
    if (correct) fc.chaserScore += 1;
    fc.chaserIndex += 1;
    if (fc.chaserIndex >= 30 || fc.secondsRemaining <= 0 || fc.chaserScore >= fc.contestantScore + fc.chaserHeadStart) {
      fc.completed = true;
      fc.outcome = fc.chaserScore < fc.contestantScore + fc.chaserHeadStart ? "contestants_win" : "chaser_wins";
      next.phase = "results";
      next.status = "completed";
      addHistory(next, "final_chase_completed", "Final Chase outcome: " + fc.outcome + ".");
    }
    return stamp(next);
  }
  function save(match) {
    assertMatch(match);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
    return { savedAt: new Date().toISOString(), key: STORAGE_KEY };
  }
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    assertMatch(parsed);
    return parsed;
  }
  function removeSaved() { localStorage.removeItem(STORAGE_KEY); }
  function exportJson(match) {
    assertMatch(match);
    return JSON.stringify(match, null, 2);
  }

  window.ChaseGame.matchEngine = Object.freeze({
    createMatch, applyAnswer, nextPlayer, advancePhase, activePlayer, totalBank,
    beginCashBuilder, resolveCashBuilderAnswer, setCashBuilderRemaining,
    beginHeadToHead, resolveHeadToHeadTurn, resolveContestantChaseAnswer, resolveChaserChaseAnswer, completeHeadToHead,
    beginFinalChase, resolveFinalChaseContestant, resolveFinalChaseChaser,
    save, load, removeSaved, exportJson, assertMatch,
    phases: PHASES.slice(), phaseLabels: { ...PHASE_LABELS },
    storageKey: STORAGE_KEY, correctAnswerValue: CORRECT_ANSWER_VALUE
  });
})();
