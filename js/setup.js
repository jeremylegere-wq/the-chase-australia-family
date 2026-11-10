/* M1: game setup state. This module creates configuration only; no round logic yet. */
(function () {
  const state = { ...window.ChaseGame.config.defaults, players: [...window.ChaseGame.config.defaults.players] };
  const $ = (id) => document.getElementById(id);
  const modeButtons = [...document.querySelectorAll("[data-mode]")];

  function cleanName(value, fallback) {
    const name = String(value || "").trim().replace(/[<>]/g, "").slice(0, 16);
    return name || fallback;
  }
  function updatePreview() {
    state.players[0] = cleanName($("player-one").value, "Player 1");
    state.players[1] = cleanName($("player-two").value, "Player 2");
    state.difficulty = $("difficulty").value;
    state.chaser = $("chaser").value;
    state.chaserPersonality = $("chaser-personality").value;
    state.presenterStyle = $("presenter-style").value;
    state.categories = $("categories").value;
    state.length = $("length").value;
    $("preview-mode").textContent = state.mode.toUpperCase() + " MODE";
    $("preview-p1").textContent = state.players[0].toUpperCase();
    $("preview-p2").textContent = state.players[1].toUpperCase();
    $("preview-chaser").textContent = window.ChaseGame.config.chaser[state.chaser].label.toUpperCase() + " STRENGTH";
  }
  modeButtons.forEach((button) => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    modeButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    updatePreview();
  }));
  ["player-one", "player-two", "difficulty", "chaser", "chaser-personality", "presenter-style", "categories", "length"].forEach((id) => {
    $(id).addEventListener("input", updatePreview);
    $(id).addEventListener("change", updatePreview);
  });
  $("start-match").addEventListener("click", () => {
    updatePreview();
    window.ChaseGame.currentMatch = Object.freeze({
      mode: state.mode,
      players: [...state.players],
      difficulty: state.difficulty,
      chaser: state.chaser,
      chaserPersonality: state.chaserPersonality,
      presenterStyle: state.presenterStyle,
      categories: state.categories,
      length: state.length,
      createdAt: new Date().toISOString()
    });
    window.dispatchEvent(new CustomEvent("chase:matchcreated", { detail: window.ChaseGame.currentMatch }));
    window.ChaseGame.navigate("studio");
  });
  window.ChaseGame.getSetupState = () => ({ ...state, players: [...state.players] });
  updatePreview();
})();
