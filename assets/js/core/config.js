(function () {
  "use strict";

  window.CTConfig = {
    appName: "Monitoramento de Entregas SP",
    companyName: "J&T Express",
    version: "4.0.0",
    pages: {
      home: "../index.html",
      dashboard: "./dashboard.html",
      relatorios: "./relatorios.html",
      insucessos: "./insucessos.html",
      acompanhamentoGeral: "./acompanhamento-geral.html"
    },
    storageKeys: {
      monitoramento: "monitoramento_local_state_v2",
      insucessos: "insucessos_local_state_v2",
      acompanhamentoGeral: "acompanhamentoGeralState.v1",
      relatorios: "monitoramento_reports_db"
    },
    dependencies: {
      dashboard: ["XLSX", "html2canvas", "Chart"],
      insucessos: ["XLSX", "Chart"],
      "acompanhamento-geral": ["XLSX", "Chart"],
      relatorios: []
    }
  };
})();
