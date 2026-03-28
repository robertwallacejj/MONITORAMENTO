(function () {
  "use strict";

  const U = window.CTUtils;
  const Excel = window.CTExcel;
  const Metrics = window.CTMetrics;
  const Charts = window.CTCharts || {};

  const STORAGE_KEY = "monitoramento_local_state_v2";

  const state = {
    rows: [],
    lastUpdate: null,
    listsExpanded: false,
    filters: {
      regional: "all",
      status: "all",
      base: "all",
      search: "",
      target: 90,
      sort: "asc"
    }
  };

  function saveLocalState() {
    U.storageSet(STORAGE_KEY, {
      rows: state.rows,
      lastUpdate: state.lastUpdate,
      listsExpanded: state.listsExpanded
    });
  }

  function loadLocalState() {
    const stored = U.storageGet(STORAGE_KEY, null);
    if (!stored || !Array.isArray(stored.rows)) return;
    state.rows = stored.rows;
    state.lastUpdate = stored.lastUpdate || null;
    state.listsExpanded = Boolean(stored.listsExpanded);
  }

  function setStorageBadge() {
    U.setText("storageStatus", state.rows.length ? "Dados locais: preenchidos" : "Dados locais: vazios");
  }

  function setImportBadge(text) {
    U.setText("importPreviewBadge", text || "Nenhum arquivo selecionado");
  }

  function updateExpandAllButtonLabel() {
    const button = U.byId("toggleAllListsBtn");
    if (!button) return;
    button.textContent = state.listsExpanded ? "Recolher listas" : "Expandir listas";
  }

  function ensureGlobalExpandButton() {
    const controlRight = document.querySelector(".control-right");
    if (!controlRight) return;

    let button = U.byId("toggleAllListsBtn");
    if (button) {
      updateExpandAllButtonLabel();
      return;
    }

    button = document.createElement("button");
    button.id = "toggleAllListsBtn";
    button.className = "btn-secondary";
    button.type = "button";
    button.textContent = state.listsExpanded ? "Recolher listas" : "Expandir listas";

    button.addEventListener("click", function () {
      state.listsExpanded = !state.listsExpanded;
      updateExpandAllButtonLabel();
      saveLocalState();
      renderAll();
    });

    controlRight.prepend(button);
  }

  function getFiltersFromUI() {
    state.filters.regional = U.byId("regionalFilter") ? U.byId("regionalFilter").value : "all";
    state.filters.base = U.byId("baseFilter") ? U.byId("baseFilter").value : "all";
    state.filters.status = U.byId("statusFilter") ? U.byId("statusFilter").value : "all";
    state.filters.search = U.byId("searchInput") ? U.byId("searchInput").value.trim() : "";
    state.filters.target = Number(U.byId("metaSlaInput") ? U.byId("metaSlaInput").value : 90) || 90;
    return state.filters;
  }

  function getBaseMetrics() {
    return Metrics.aggregateBaseMetrics(state.rows);
  }

  function getFilteredMetrics() {
    return Metrics.filterMetrics(getBaseMetrics(), getFiltersFromUI());
  }

  function getAllDriversData() {
    return Metrics.aggregateDrivers(state.rows).filter(function (item) {
      return item.base && item.driver;
    });
  }

  function getFilteredDrivers() {
    const normalizedSearch = U.normalizar(state.filters.search || "");
    return getAllDriversData().filter(function (item) {
      const matchesRegional = state.filters.regional === "all" || Metrics.getRegionalFromBase(item.baseOriginal || item.base) === state.filters.regional;
      const matchesBase = state.filters.base === "all" || item.base === state.filters.base;
      const matchesSearch =
        !normalizedSearch ||
        U.normalizar(item.base).includes(normalizedSearch) ||
        U.normalizar(item.driver).includes(normalizedSearch);

      return matchesRegional && matchesBase && matchesSearch;
    });
  }

  function populateBaseFilter(metrics) {
    const baseFilter = U.byId("baseFilter");
    if (!baseFilter) return;

    const currentValue = baseFilter.value || "all";
    const bases = metrics.map(function (item) { return item.base; });

    baseFilter.innerHTML =
      '<option value="all">Todas as bases</option>' +
      bases.map(function (base) {
        return '<option value="' + U.escapeHtml(base) + '">' + U.escapeHtml(base) + "</option>";
      }).join("");

    if (bases.includes(currentValue)) {
      baseFilter.value = currentValue;
    }
  }

  function populateRegionalFilter(metrics) {
    const regionalFilter = U.byId("regionalFilter");
    if (!regionalFilter) return;

    const currentValue = regionalFilter.value || "all";
    const regionais = Array.from(
      new Set(metrics.map(function (item) { return item.regional || "Não definida"; }))
    ).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR");
    });

    regionalFilter.innerHTML =
      '<option value="all">Todas</option>' +
      regionais.map(function (regional) {
        return '<option value="' + U.escapeHtml(regional) + '">' + U.escapeHtml(regional) + "</option>";
      }).join("");

    if (regionais.includes(currentValue)) {
      regionalFilter.value = currentValue;
    }
  }

  function getGlobalSummary(metrics) {
    return metrics.reduce(function (acc, item) {
      acc.total += item.total;
      acc.entregue += item.entregue;
      acc.problematico += item.problematico;
      acc.naoEntregue += item.naoEntregue;
      acc.pendente += item.pendente;
      acc.insucesso += item.insucesso;
      return acc;
    }, {
      total: 0,
      entregue: 0,
      problematico: 0,
      naoEntregue: 0,
      pendente: 0,
      insucesso: 0
    });
  }

  function renderSummary(metrics, global) {
    U.setText("summaryBases", U.formatNumber(metrics.length));
    U.setText("summaryTotal", U.formatNumber(global.total));
    U.setText("summaryDelivered", U.formatNumber(global.entregue));
    U.setText("summaryRate", U.formatPercent(global.total ? (global.entregue / global.total) * 100 : 0, 2));
    U.setText("summaryPending", U.formatNumber(global.naoEntregue + global.pendente));
    U.setText("summaryFailure", U.formatNumber(global.insucesso));
    U.setText("lastUpdateText", state.lastUpdate ? ("Última leitura: " + U.formatDateTimeBR(state.lastUpdate)) : "Última leitura: --");
  }

  function buildDriverRows(drivers) {
    return drivers.map(function (item) {
      return [
        "<tr>",
        "<td>" + U.escapeHtml(item.driver) + "</td>",
        "<td>" + U.escapeHtml(item.base) + "</td>",
        '<td class="t-right">' + U.formatNumber(item.total) + "</td>",
        '<td class="t-right">' + U.formatPercent(item.taxa, 1) + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderDriverRankings() {
    const drivers = getFilteredDrivers()
      .filter(function (item) { return item.total > 0 && item.taxa < 100; });

    const ranked = [].concat(drivers).sort(function (a, b) {
      if (b.taxa !== a.taxa) return b.taxa - a.taxa;
      if (b.entregue !== a.entregue) return b.entregue - a.entregue;
      return a.driver.localeCompare(b.driver, "pt-BR");
    });

    const worst = [].concat(drivers).sort(function (a, b) {
      if (a.taxa !== b.taxa) return a.taxa - b.taxa;
      if (b.insucesso !== a.insucesso) return b.insucesso - a.insucesso;
      return a.driver.localeCompare(b.driver, "pt-BR");
    });

    U.setHtml(
      "topDriversTable",
      ranked.length
        ? buildDriverRows(ranked.slice(0, 10))
        : '<tr><td colspan="4" class="text-soft">Sem motoristas abaixo de 100% para mostrar.</td></tr>'
    );

    U.setHtml(
      "worstDriversTable",
      worst.length
        ? buildDriverRows(worst.slice(0, 10))
        : '<tr><td colspan="4" class="text-soft">Sem motoristas abaixo de 100% para mostrar.</td></tr>'
    );
  }

  function renderCharts(metrics, global) {
    const globalCanvas = U.byId("globalChart");
    if (globalCanvas && Charts.renderGlobalChart) {
      Charts.renderGlobalChart(globalCanvas, global);
    }

    const basesCanvas = U.byId("basesChart");
    if (basesCanvas && Charts.renderBasesChart) {
      if (metrics.length) {
        Charts.renderBasesChart(basesCanvas, metrics, state.filters.sort);
      } else if (Charts.destroyBasesChart) {
        Charts.destroyBasesChart();
      }
    }
  }

  function groupDriversByBase(drivers) {
    return drivers.reduce(function (acc, item) {
      const base = item.base || "Sem base";
      if (!acc[base]) acc[base] = [];
      acc[base].push(item);
      return acc;
    }, {});
  }

  function buildBaseDriversHtml(baseDrivers) {
    const filteredDrivers = (baseDrivers || []).filter(function (item) {
      return item.total > 0 && item.pendente > 0;
    });

    if (!filteredDrivers.length) {
      return [
        '<div class="driver-section driver-section-empty-state">',
        '<div class="driver-section-title">Motoristas da base</div>',
        '<div class="driver-empty">Todos os motoristas desta base estão com 100% ou não há dados detalhados para exibir.</div>',
        "</div>"
      ].join("");
    }

    const rows = filteredDrivers
      .sort(function (a, b) {
        if (state.filters.sort === "asc") {
          if (a.taxa !== b.taxa) return a.taxa - b.taxa;
          if (b.insucesso !== a.insucesso) return b.insucesso - a.insucesso;
          return (a.driver || "").localeCompare(b.driver || "", "pt-BR");
        }

        if (b.taxa !== a.taxa) return b.taxa - a.taxa;
        if (a.insucesso !== b.insucesso) return a.insucesso - b.insucesso;
        return (a.driver || "").localeCompare(b.driver || "", "pt-BR");
      })
      .map(function (item) {
        let taxaClass = "text-danger";
        if (item.taxa >= 90) taxaClass = "text-success";
        else if (item.taxa >= 80) taxaClass = "text-warning";

        return [
          "<tr>",
          '<td class="driver-name-cell">' + U.escapeHtml(item.driver) + "</td>",
          '<td class="t-right">' + U.formatNumber(item.pendente) + "</td>",
          '<td class="t-right">' + U.formatNumber(item.entregue) + "</td>",
          '<td class="t-right">' + U.formatNumber(item.insucesso) + "</td>",
          '<td class="t-right">' + U.formatNumber(item.total) + "</td>",
          '<td class="t-right ' + taxaClass + ' font-weight-bold">' + U.formatPercent(item.taxa || 0, 1) + "</td>",
          "</tr>"
        ].join("");
      }).join("");

    const collapsedClass = state.listsExpanded ? "" : " collapsed";

    return [
      '<div class="driver-section' + collapsedClass + '">',
      '<div class="driver-section-header">',
      '<div class="driver-section-title">Motoristas da base</div>',
      '<div class="driver-section-count">' + U.formatNumber(filteredDrivers.length) + " motorista(s)</div>",
      "</div>",
      '<div class="driver-table-wrap">',
      '<table class="driver-table">',
      "<thead>",
      "<tr>",
      "<th>Motorista</th>",
      '<th class="t-right">Baixa Pendente</th>',
      '<th class="t-right">Entregue</th>',
      '<th class="t-right">Insucesso</th>',
      '<th class="t-right">Total Geral</th>',
      '<th class="t-right">Desempenho (%)</th>',
      "</tr>",
      "</thead>",
      "<tbody>",
      rows,
      "</tbody>",
      "</table>",
      "</div>",
      !state.listsExpanded ? '<div class="driver-collapsed-note">Lista recolhida. Use "Expandir listas" no topo para visualizar os nomes.</div>' : "",
      "</div>"
    ].join("");
  }

  function buildBaseDashboardHtml(item, target, driversByBase) {
    const colorClass =
      item.taxa >= target ? "status-ok" :
      item.taxa >= target - 10 ? "status-warn" :
      "status-bad";

    const rowClass = item.taxa < target ? "capture-container critical" : "capture-container";
    const baseDrivers = driversByBase[item.base] || [];

    return [
      '<article class="' + rowClass + '" data-base="' + U.escapeHtml(item.base) + '">',
      '<div class="capture-body" data-capture-body="true">',

      '<header class="capture-header capture-header-top">',
      '<div class="header-left">',
      '<div class="base-name-label">Base</div>',
      '<h3 class="base-name-value">' + U.escapeHtml(item.base) + '</h3>',
      '<div class="text-soft">' + U.escapeHtml(item.regional) + '</div>',
      '</div>',

      '<div class="header-center-logo">',
      '<img src="./logo-monitoramento.png" alt="Logo Monitoramento" class="header-logo-image">',
      '</div>',

      '<div class="header-right">',
      '<div class="report-date">Atualização: ' + U.escapeHtml(U.formatDateTimeBR(state.lastUpdate)) + '</div>',
      '<div class="eficacia-pill ' + colorClass + '">SLA ' + U.formatPercent(item.taxa, 2) + '</div>',
      '</div>',
      '</header>',

      '<div class="kpi-grid">',
      '<div class="kpi-card kpi-info"><small>Total Expedido</small><div class="kpi-value">' + U.formatNumber(item.total) + '</div></div>',
      '<div class="kpi-card kpi-success"><small>Entregues</small><div class="kpi-value">' + U.formatNumber(item.entregue) + '</div></div>',
      '<div class="kpi-card kpi-warning"><small>Baixa Pendente</small><div class="kpi-value">' + U.formatNumber(item.naoEntregue + item.pendente) + '</div></div>',
      '<div class="kpi-card kpi-danger"><small>Insucesso</small><div class="kpi-value">' + U.formatNumber(item.insucesso) + '</div></div>',
      '</div>',

      '<div class="mini-info-row">',
      '<div class="mini-info-pill">Pendente: <strong>' + U.formatNumber(item.pendente) + '</strong></div>',
      '<div class="mini-info-pill">Não entregue: <strong>' + U.formatNumber(item.naoEntregue) + '</strong></div>',
      '<div class="mini-info-pill">Meta: <strong>' + (item.taxa >= target ? 'OK' : 'Ação') + '</strong></div>',
      '<div class="mini-info-pill">Regional: <strong>' + U.escapeHtml(item.regional) + '</strong></div>',
      '</div>',

      buildBaseDriversHtml(baseDrivers),

      '</div>',

      '<div class="action-area" data-no-capture="true">',
      '<button class="btn-secondary" data-action="download" data-base="' + U.escapeHtml(item.base) + '">Baixar PNG</button>',
      '<button class="btn-secondary" data-action="copy" data-base="' + U.escapeHtml(item.base) + '">Copiar imagem</button>',
      '</div>',
      '</article>'
    ].join("");
  }

  function renderMonitorByBase(filteredMetrics) {
    const content = U.byId("dashboardsContent");
    const empty = U.byId("dashboardsEmpty");
    if (!content || !empty) return;

    if (!filteredMetrics.length) {
      content.innerHTML = "";
      empty.hidden = false;
      populateDownloadList(filteredMetrics);
      return;
    }

    const driversByBase = groupDriversByBase(getFilteredDrivers());
    empty.hidden = true;

    content.innerHTML = filteredMetrics.map(function (item) {
      return buildBaseDashboardHtml(item, state.filters.target, driversByBase);
    }).join("");

    U.qsa('[data-action="download"]', content).forEach(function (button) {
      button.addEventListener("click", function () {
        downloadReportPNG(button.getAttribute("data-base")).catch(console.error);
      });
    });

    U.qsa('[data-action="copy"]', content).forEach(function (button) {
      button.addEventListener("click", function () {
        copyReportPNG(button.getAttribute("data-base"), button).catch(console.error);
      });
    });

    populateDownloadList(filteredMetrics);
  }

  async function buildCardCanvas(baseName) {
    const selector = '[data-base="' + CSS.escape(baseName) + '"]';
    const node = document.querySelector(selector);

    if (!node || typeof html2canvas === "undefined") {
      throw new Error("Card não encontrado ou html2canvas indisponível.");
    }

    const body = node.querySelector("[data-capture-body='true']") || node;

    return html2canvas(body, {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: 2
    });
  }

  async function downloadReportPNG(baseName) {
    const canvas = await buildCardCanvas(baseName);
    U.downloadBlobURL(canvas.toDataURL("image/png"), U.sanitizeFilename(baseName) + ".png");
  }

  async function copyReportPNG(baseName, button) {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      U.showMessage("appMessage", "Cópia de imagem não suportada neste navegador/arquivo local. Use Baixar PNG.", "warning");
      return;
    }

    const originalText = button ? button.textContent : "";
    const canvas = await buildCardCanvas(baseName);

    try {
      const blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, "image/png");
      });

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);

      if (button) button.textContent = "Imagem copiada";

      setTimeout(function () {
        if (button) button.textContent = originalText;
      }, 1400);
    } catch (error) {
      U.showMessage("appMessage", "Não foi possível copiar a imagem. Em alguns navegadores no modo local, essa ação pode ser bloqueada.", "warning");
    }
  }

  function populateDownloadList(metrics) {
    const container = U.byId("downloadItems");
    if (!container) return;

    container.innerHTML = metrics.map(function (item) {
      return '<label><input type="checkbox" value="' + U.escapeHtml(item.base) + '" checked> ' + U.escapeHtml(item.base) + "</label>";
    }).join("");
  }

  async function downloadSelectedImages() {
    const checked = U.qsa('#downloadItems input[type="checkbox"]:checked').map(function (input) {
      return input.value;
    });

    for (let i = 0; i < checked.length; i += 1) {
      await downloadReportPNG(checked[i]);
    }
  }

  function renderAll() {
    const baseMetrics = getBaseMetrics();
    const filteredMetrics = getFilteredMetrics();
    const global = getGlobalSummary(filteredMetrics);

    populateBaseFilter(baseMetrics);
    populateRegionalFilter(baseMetrics);
    renderMonitorByBase(filteredMetrics);
    renderSummary(filteredMetrics, global);
    renderDriverRankings();
    renderCharts(filteredMetrics, global);
    setStorageBadge();
    updateExpandAllButtonLabel();
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
    U.showMessage("appMessage", "Lendo arquivos, validando colunas e gerando o painel...", "info");

    try {
      const analyses = await Excel.inspectFiles(files);
      const selectedSheetsMap = {};

      analyses.forEach(function (item) {
        selectedSheetsMap[item.fileName] = item.selectedSheetName;
      });

      const preview = Excel.buildPreviewReport(analyses, selectedSheetsMap);
      const invalidFiles = preview.files.filter(function (item) {
        return !item.validation.isUsable;
      });

      if (!preview.files.length) {
        U.showMessage("appMessage", "Nenhuma aba válida foi encontrada nos arquivos selecionados.", "warning");
        return;
      }

      if (invalidFiles.length) {
        const names = invalidFiles.map(function (item) { return item.fileName; }).join(", ");
        U.showMessage("appMessage", "Há arquivo(s) com estrutura incompleta: " + names + ". Verifique as colunas obrigatórias.", "warning");
        return;
      }

      const importedRows = preview.files.flatMap(function (item) {
        return item.normalizedRows;
      });

      state.rows = Excel.mergeImportedRows([], importedRows, "replace");
      state.lastUpdate = new Date().toISOString();

      saveLocalState();
      renderAll();

      setImportBadge(preview.report.fileCount + " arquivo(s) processado(s)");
      U.showMessage("appMessage", "Painel gerado com sucesso. " + preview.report.validRows + " linhas válidas processadas.", "success");
    } catch (error) {
      U.showMessage("appMessage", error.message || "Falha ao ler os arquivos Excel.", "error");
    } finally {
      if (input) input.value = "";
    }
  }

  function bindActions() {
    const importBtn = U.byId("importBtn");
    const input = U.byId("excelFiles");

    if (importBtn && input) {
      importBtn.addEventListener("click", function () {
        input.click();
      });

      input.addEventListener("change", function () {
        importFilesAndGenerate().catch(console.error);
      });
    }

    const clearDataBtn = U.byId("clearDataBtn");
    if (clearDataBtn) {
      clearDataBtn.addEventListener("click", clearLocalData);
    }
  }

  function initGridSearch() {
    const gridSelector = U.byId("gridSelector");
    const dashboards = U.byId("dashboardsContent");
    const refresh = U.debounce(renderAll, 180);

    if (gridSelector && dashboards) {
      gridSelector.value = "1";

      gridSelector.addEventListener("change", function () {
        dashboards.style.gridTemplateColumns = "repeat(" + gridSelector.value + ", minmax(0, 1fr))";
      });

      dashboards.style.gridTemplateColumns = "repeat(" + gridSelector.value + ", minmax(0, 1fr))";
    }

    ["searchInput", "statusFilter", "regionalFilter", "baseFilter", "metaSlaInput"].forEach(function (id) {
      const el = U.byId(id);
      if (!el) return;
      el.addEventListener("input", refresh);
      el.addEventListener("change", refresh);
    });

    const searchBtn = U.byId("searchBtn");
    if (searchBtn) {
      searchBtn.addEventListener("click", refresh);
    }

    const btnSort = U.byId("btnSort");
    if (btnSort) {
      btnSort.textContent =
        state.filters.sort === "asc"
          ? "Piores primeiro"
          : "Melhores primeiro";

      btnSort.addEventListener("click", function () {
        state.filters.sort = state.filters.sort === "asc" ? "desc" : "asc";

        btnSort.textContent =
          state.filters.sort === "asc"
            ? "Piores primeiro"
            : "Melhores primeiro";

        renderAll();
      });
    }

    const toggle = U.byId("downloadToggle");
    const list = U.byId("downloadList");
    if (toggle && list) {
      toggle.addEventListener("click", function () {
        list.hidden = !list.hidden;
      });
    }

    const selectAll = U.byId("selectAllDownloads");
    if (selectAll) {
      selectAll.addEventListener("change", function () {
        U.qsa('#downloadItems input[type="checkbox"]').forEach(function (input) {
          input.checked = selectAll.checked;
        });
      });
    }

    const downloadSelected = U.byId("downloadSelected");
    if (downloadSelected) {
      downloadSelected.addEventListener("click", function () {
        downloadSelectedImages().catch(console.error);
      });
    }
  }

  function clearLocalData() {
    if (!window.confirm("Deseja limpar todos os dados locais deste painel?")) return;
    state.rows = [];
    state.lastUpdate = null;
    state.listsExpanded = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Falha ao limpar o storage do monitoramento.", error);
    }
    setImportBadge("Nenhum arquivo selecionado");
    U.clearMessage("appMessage");
    renderAll();
  }

  async function initApp() {
    loadLocalState();
    ensureGlobalExpandButton();
    bindActions();
    initGridSearch();
    renderAll();
  }

  window.CTDashboard = {
    initApp: initApp,
    renderAll: renderAll,
    downloadReportPNG: downloadReportPNG,
    copyReportPNG: copyReportPNG,
    clearLocalData: clearLocalData
  };
})();