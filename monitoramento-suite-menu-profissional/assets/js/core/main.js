(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    if (window.CTDashboard && typeof window.CTDashboard.initApp === "function") {
      window.CTDashboard.initApp().catch(function (error) {
        console.error("Falha ao iniciar o Monitoramento.", error);
        if (window.CTUtils) {
          window.CTUtils.showMessage("appMessage", error.message || "Falha ao iniciar o aplicativo.", "error");
        }
      });
    }
  });
})();