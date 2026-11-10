/* M1: small screen router. */
(function () {
  const screens = ["home", "setup", "studio"];
  function show(name) {
    screens.forEach((screen) => {
      const node = document.getElementById("screen-" + screen);
      if (!node) return;
      node.classList.toggle("screen-active", screen === name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("chase:screenchange", { detail: { screen: name } }));
  }
  window.ChaseGame.navigate = show;
  document.getElementById("go-setup").addEventListener("click", () => show("setup"));
  document.getElementById("back-home").addEventListener("click", () => show("home"));
  document.getElementById("return-menu").addEventListener("click", () => show("home"));
  document.getElementById("edit-setup").addEventListener("click", () => show("setup"));
})();
