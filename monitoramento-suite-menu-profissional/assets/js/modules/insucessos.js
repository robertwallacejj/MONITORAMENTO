(function () {
  "use strict";

  const U = window.CTUtils;
  const Metrics = window.CTInsucessosMetrics;

  const STORAGE_KEY = "insucessos_local_state_v2";

  const state = {
    rows: [],
    lastUpdate: null,
    detailsCollapsed: false,
    filters: {
      base: "all",
      date: "all",
      reason: "all",
      search: ""
    }
  };

  let basesChartInstance = null;
  let datesChartInstance = null;

  function saveLocalState() {
    U.storageSet(STORAGE_KEY, {
      rows: state.rows,
      lastUpdate: state.lastUpdate,
      detailsCollapsed: state.detailsCollapsed
    });
  }

  function loadLocalState() {
    const stored = U.storageGet(STORAGE_KEY, null);
    if (!stored) return;

    state.rows = Array.isArray(stored.rows) ? stored.rows : [];
    state.lastUpdate = stored.lastUpdate || null;
    state.detailsCollapsed = Boolean(stored.detailsCollapsed);
  }

  function setStorageBadge() {
    U.setText("storageStatus", state.rows.length ? "Dados locais: preenchidos" : "Dados locais: vazios");
  }

  function setImportBadge(text) {
    U.setText("importPreviewBadge", text || "Nenhum arquivo selecionado");
  }

  function getFiltersFromUI() {
    state.filters.base = U.byId("baseFilter") ? U.byId("baseFilter").value : "all";
    state.filters.date = U.byId("dateFilter") ? U.byId("dateFilter").value : "all";
    state.filters.reason = U.byId("reasonFilter") ? U.byId("reasonFilter").value : "all";
    state.filters.search = U.byId("searchInput") ? U.byId("searchInput").value.trim() : "";
    return state.filters;
  }

  function getFilteredRows() {
    return Metrics.filterRows(state.rows, getFiltersFromUI());
  }

  function populateFilter(id, values, defaultLabel) {
    const select = U.byId(id);
    if (!select) return;

    const currentValue = select.value || "all";
    const uniqueValues = Array.from(new Set(values)).filter(Boolean);

    select.innerHTML =
      '<option value="all">' + U.escapeHtml(defaultLabel) + "</option>" +
      uniqueValues.map(function (item) {
        return '<option value="' + U.escapeHtml(item) + '">' + U.escapeHtml(item) + "</option>";
      }).join("");

    if (uniqueValues.includes(currentValue)) {
      select.value = currentValue;
    }
  }

  function populateFilters() {
    populateFilter(
      "baseFilter",
      state.rows.map(function (item) { return item.base; }).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }),
      "Todas"
    );

    populateFilter(
      "dateFilter",
      Metrics.sortDatesBR(state.rows.map(function (item) { return item.date; })),
      "Todas"
    );

    populateFilter(
      "reasonFilter",
      state.rows.map(function (item) { return item.reason; }).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }),
      "Todos"
    );
  }

  function getBadgeHtml(level) {
    const label = Metrics.severityLabel(level);
    const cssClass =
      level === "danger" ? "ins-badge ins-badge-danger" :
      level === "warning" ? "ins-badge ins-badge-warning" :
      "ins-badge ins-badge-success";

    return '<span class="' + cssClass + '">' + U.escapeHtml(label) + "</span>";
  }

  function getDetailsCardLevel(total) {
    if (total >= 30) return "danger";
    if (total >= 10) return "warning";
    return "success";
  }

  function updateDetailsCollapseUI() {
    const content = U.byId("detailsContent");
    const button = U.byId("toggleDetailsBtn");

    if (content) {
      content.classList.toggle("is-collapsed", state.detailsCollapsed);
    }

    if (button) {
      button.textContent = state.detailsCollapsed ? "Expandir" : "Recolher";
    }
  }

  function renderSummary(rows) {
    const summary = Metrics.buildSummary(rows);
    const insights = Metrics.buildInsightText(rows);

    U.setText("summaryTotalInsucessos", U.formatNumber(summary.totalInsucessos));
    U.setText("summaryBases", U.formatNumber(summary.totalBases));
    U.setText("summaryDatas", U.formatNumber(summary.totalDatas));
    U.setText("summaryTopReason", summary.topReason);
    U.setText("summaryTopBase", summary.topBase);
    U.setText("summaryTopDate", summary.topDate);
    U.setText("summaryAvgBase", U.formatNumber(summary.avgPerBase.toFixed(1)));
    U.setText("summaryAvgDate", U.formatNumber(summary.avgPerDate.toFixed(1)));

    U.setText(
      "lastUpdateText",
      state.lastUpdate ? ("Última leitura: " + U.formatDateTimeBR(state.lastUpdate)) : "Última leitura: --"
    );

    U.setText("insightMain", insights.main);
    U.setText("insightBase", insights.base);
    U.setText("insightReason", insights.reason);
  }

  function destroyChart(instance) {
    if (instance && typeof instance.destroy === "function") {
      instance.destroy();
    }
  }

  function renderBasesChart(rows) {
    const canvas = U.byId("basesChart");
    if (!canvas || typeof Chart === "undefined") return;

    const ranking = Metrics.groupCount(rows, "base").slice(0, 15);

    destroyChart(basesChartInstance);
    basesChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ranking.map(function (item) { return item.label; }),
        datasets: [{
          label: "Insucessos",
          data: ranking.map(function (item) { return item.total; }),
          backgroundColor: ranking.map(function (item) {
            const level = Metrics.getSeverityByValue(item.total, 3, 6);
            if (level === "danger") return "#ef4444";
            if (level === "warning") return "#f59e0b";
            return "#16a34a";
          })
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderDatesChart(rows) {
    const canvas = U.byId("datesChart");
    if (!canvas || typeof Chart === "undefined") return;

    const ranking = Metrics.groupCount(rows, "date");
    const orderedLabels = Metrics.sortDatesBR(ranking.map(function (item) { return item.label; }));
    const orderedData = orderedLabels.map(function (label) {
      const found = ranking.find(function (item) { return item.label === label; });
      return found ? found.total : 0;
    });

    destroyChart(datesChartInstance);
    datesChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: orderedLabels,
        datasets: [{
          label: "Insucessos",
          data: orderedData,
          borderColor: "#d81f26",
          backgroundColor: "rgba(216,31,38,0.10)",
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  function renderReasonsTable(rows) {
    const table = U.byId("reasonsTable");
    if (!table) return;

    const ranking = Metrics.groupCount(rows, "reason");

    if (!ranking.length) {
      table.innerHTML = '<tr><td colspan="3" class="text-soft">Sem dados</td></tr>';
      return;
    }

    table.innerHTML = ranking.map(function (item) {
      const level = Metrics.getSeverityByValue(item.total, 3, 6);

      return [
        "<tr>",
        '<td class="reason-cell">' + U.escapeHtml(item.label) + "</td>",
        '<td class="t-right">' + U.formatNumber(item.total) + "</td>",
        '<td class="t-right">' + getBadgeHtml(level) + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderBasesTable(rows) {
    const table = U.byId("basesTable");
    if (!table) return;

    const ranking = Metrics.groupCount(rows, "base");

    if (!ranking.length) {
      table.innerHTML = '<tr><td colspan="3" class="text-soft">Sem dados</td></tr>';
      return;
    }

    table.innerHTML = ranking.map(function (item) {
      const level = Metrics.getSeverityByValue(item.total, 3, 6);

      return [
        "<tr>",
        "<td>" + U.escapeHtml(item.label) + "</td>",
        '<td class="t-right">' + U.formatNumber(item.total) + "</td>",
        '<td class="t-right">' + getBadgeHtml(level) + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderDriversTables(rows) {
    const topTable = U.byId("topDriversTable");
    const lowTable = U.byId("lowDriversTable");
    if (!topTable || !lowTable) return;

    const ranking = Metrics.groupDrivers(rows).filter(function (item) {
      return item.driver && item.driver !== "NÃO ATRIBUÍDO";
    });

    if (!ranking.length) {
      topTable.innerHTML = '<tr><td colspan="4" class="text-soft">Sem dados</td></tr>';
      lowTable.innerHTML = '<tr><td colspan="4" class="text-soft">Sem dados</td></tr>';
      return;
    }

    const top = ranking.slice(0, 10);

    const low = ranking
      .slice()
      .sort(function (a, b) {
        if (a.total !== b.total) return a.total - b.total;
        if (a.base !== b.base) return a.base.localeCompare(b.base, "pt-BR");
        return a.driver.localeCompare(b.driver, "pt-BR");
      })
      .slice(0, 10);

    topTable.innerHTML = top.map(function (item) {
      const level = Metrics.getSeverityByValue(item.total, 2, 5);
      return [
        "<tr>",
        '<td class="rank-name">' + U.escapeHtml(item.driver) + "</td>",
        "<td>" + U.escapeHtml(item.base) + "</td>",
        '<td class="t-right">' + U.formatNumber(item.total) + "</td>",
        '<td class="t-right">' + getBadgeHtml(level) + "</td>",
        "</tr>"
      ].join("");
    }).join("");

    lowTable.innerHTML = low.map(function (item) {
      const level = Metrics.getSeverityByValue(item.total, 2, 5);
      return [
        "<tr>",
        '<td class="rank-name">' + U.escapeHtml(item.driver) + "</td>",
        "<td>" + U.escapeHtml(item.base) + "</td>",
        '<td class="t-right">' + U.formatNumber(item.total) + "</td>",
        '<td class="t-right">' + getBadgeHtml(level === "danger" ? "warning" : "success") + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderDetailsTable(rows) {
    const table = U.byId("detailsTable");
    const countBadge = U.byId("detailsCountBadge");
    const detailsMeta = U.byId("detailsMeta");
    const detailsCard = U.byId("detailsCard");

    if (countBadge) {
      countBadge.textContent = U.formatNumber(rows.length) + " linha(s)";
    }

    if (detailsMeta) {
      detailsMeta.textContent = rows.length
        ? "Visualizando " + U.formatNumber(rows.length) + " registro(s) após os filtros aplicados."
        : "Nenhum registro encontrado com os filtros atuais.";
    }

    if (detailsCard) {
      detailsCard.classList.remove("details-success", "details-warning", "details-danger");
      detailsCard.classList.add("details-" + getDetailsCardLevel(rows.length));
    }

    if (!table) return;

    if (!rows.length) {
      table.innerHTML = '<tr><td colspan="6" class="text-soft">Nenhum dado importado.</td></tr>';
      return;
    }

    table.innerHTML = rows.map(function (item) {
      const level = Metrics.getSeverityByValue(1, 1, 2);

      return [
        "<tr>",
        "<td>" + U.escapeHtml(item.date) + "</td>",
        "<td>" + U.escapeHtml(item.base) + "</td>",
        "<td>" + U.escapeHtml(item.driver) + "</td>",
        '<td class="reason-cell">' + U.escapeHtml(item.reason) + "</td>",
        "<td>" + U.escapeHtml(item.fileName) + "</td>",
        '<td class="t-right">' + getBadgeHtml(level) + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderAll() {
    populateFilters();

    const filteredRows = getFilteredRows();

    renderSummary(filteredRows);
    renderBasesChart(filteredRows);
    renderDatesChart(filteredRows);
    renderReasonsTable(filteredRows);
    renderBasesTable(filteredRows);
    renderDriversTables(filteredRows);
    renderDetailsTable(filteredRows);
    setStorageBadge();
    updateDetailsCollapseUI();
  }

  async function importFilesAndGenerate() {
    const input = U.byId("excelFiles");
    const files = input && input.files ? input.files : [];

    if (!files.length) {
      U.showMessage("appMessage", "Selecione pelo menos um arquivo Excel.", "warning");
      setImportBadge("Nenhum arquivo selecionado");
      return;
    }

    setImportBadge(files.length + " arquivo(s) selecionado(s)");
    U.showMessage("appMessage", "Lendo arquivos e consolidando insucessos...", "info");

    try {
      const rows = await Metrics.inspectFiles(files);

      state.rows = rows;
      state.lastUpdate = new Date().toISOString();

      saveLocalState();
      renderAll();

      U.showMessage(
        "appMessage",
        "Importação concluída com sucesso. " + rows.length + " insucesso(s) encontrado(s).",
        "success"
      );
      setImportBadge(files.length + " arquivo(s) processado(s)");
    } catch (error) {
      U.showMessage("appMessage", error.message || "Falha ao ler os arquivos.", "error");
    } finally {
      if (input) input.value = "";
    }
  }

  function bindActions() {
    const importBtn = U.byId("importBtn");
    const input = U.byId("excelFiles");
    const refresh = U.debounce(renderAll, 180);

    if (importBtn && input) {
      importBtn.addEventListener("click", function () {
        input.click();
      });

      input.addEventListener("change", function () {
        importFilesAndGenerate().catch(console.error);
      });
    }

    ["baseFilter", "dateFilter", "reasonFilter", "searchInput"].forEach(function (id) {
      const el = U.byId(id);
      if (!el) return;
      el.addEventListener("change", refresh);
      el.addEventListener("input", refresh);
    });

    const searchBtn = U.byId("searchBtn");
    if (searchBtn) {
      searchBtn.addEventListener("click", renderAll);
    }

    const toggleDetailsBtn = U.byId("toggleDetailsBtn");
    if (toggleDetailsBtn) {
      toggleDetailsBtn.addEventListener("click", function () {
        state.detailsCollapsed = !state.detailsCollapsed;
        saveLocalState();
        updateDetailsCollapseUI();
      });
    }
  }

  function clearLocalData() {
    if (!window.confirm("Deseja limpar todos os dados locais deste painel de insucessos?")) return;
    state.rows = [];
    state.lastUpdate = null;
    state.detailsCollapsed = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Falha ao limpar o storage de insucessos.", error);
    }
    setImportBadge("Nenhum arquivo selecionado");
    U.clearMessage("appMessage");
    renderAll();
  }

  function initApp() {
    loadLocalState();
    bindActions();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initApp();
  });
})();