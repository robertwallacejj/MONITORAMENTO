(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function appendDependencyWarning(message) {
    const box = byId("appMessage");
    if (!box) return;
    box.className = "message-box is-warning";
    box.textContent = message;
  }

  function checkDependencies() {
    const page = document.body ? document.body.getAttribute("data-page") : "dashboard";
    const config = window.CTConfig || {};
    const depMap = config.dependencies || {};
    const required = depMap[page] || [];
    const missing = required.filter(function (dep) {
      return typeof window[dep] === "undefined";
    });

    if (missing.length) {
      appendDependencyWarning(
        "Algumas bibliotecas não foram carregadas: " + missing.join(", ") + ". Abra o projeto com internet ou execute o servidor local incluso."
      );
      console.warn("Dependências ausentes:", missing);
    }
  }

  document.addEventListener("DOMContentLoaded", checkDependencies);
})();
