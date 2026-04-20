(function () {
  "use strict";

  const U = window.CTUtils || {};
  const Store = window.CTReportStore || {};
  const Metrics = window.CTMetrics || {};

  const state = {
    allSources: [],
    filteredSources: [],
    selectedIds: [],
    filters: {
      search: "",
      base: "all"
    },
    chartMetric: "sla",
    sortMode: "worst"
  };

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeText(value) {
    return U.normalizar ? U.normalizar(value) : String(value || "").toUpperCase();
  }

  function formatDate(value) {
    return U.formatDateTimeBR ? U.formatDateTimeBR(value) : String(value || "--");
  }

  function formatNumber(value) {
    return U.formatNumber ? U.formatNumber(value) : String(Number(value || 0));
  }

  function formatPercent(value, digits) {
    return U.formatPercent ? U.formatPercent(value || 0, digits == null ? 2 : digits) : `${Number(value || 0).toFixed(digits == null ? 2 : digits)}%`;
  }

  function escapeHtml(value) {
    return U.escapeHtml ? U.escapeHtml(value) : String(value || "");
  }

  function getSlaColor(slaValue) {
    const sla = Number(slaValue || 0);
    if (sla >= 95) return { color: "#16a34a", label: "Ótimo", class: "sla-green" };
    if (sla >= 90) return { color: "#f59e0b", label: "Atenção", class: "sla-yellow" };
    return { color: "#dc2626", label: "Crítico", class: "sla-red" };
  }

  function getSlaStatusClass(slaValue) {
    const sla = Number(slaValue || 0);
    if (sla >= 95) return "sla-status-green";
    if (sla >= 90) return "sla-status-yellow";
    return "sla-status-red";
  }

  function extractSourceLabel(fileName) {
    const baseName = String(fileName || "").replace(/\.[^/.]+$/, "");
    return baseName.split("(")[0].trim() || baseName;
  }

  function buildSourceDisplayName(baseMetrics, fallbackLabel, fallbackFileName) {
    const bases = toArray(baseMetrics).map(function (item) { return String(item.base || "").trim(); }).filter(Boolean);
    const uniqueBases = Array.from(new Set(bases));
    if (uniqueBases.length === 1) return uniqueBases[0];
    if (uniqueBases.length === 2) return uniqueBases.join(" • ");
    if (uniqueBases.length > 2) return `${uniqueBases[0]} +${uniqueBases.length - 1} bases`;
    return fallbackLabel || extractSourceLabel(fallbackFileName) || "Período monitorado";
  }

  function safeId(text) {
    return String(text || "item").replace(/[^a-z0-9_-]+/gi, "-");
  }

  function showMessage(message, type) {
    if (U.showMessage) U.showMessage("reportsMessage", message, type || "info");
  }

  function clearMessage() {
    if (U.clearMessage) U.clearMessage("reportsMessage");
  }

  function computeBaseMetricsFromRows(rows) {
    if (Metrics.aggregateBaseMetrics) return Metrics.aggregateBaseMetrics(rows || []);
    return [];
  }

  function computeDriversFromRows(rows) {
    if (!Metrics.aggregateDrivers) return [];
    return Metrics.aggregateDrivers(rows || []).filter(function (item) {
      return item.base && item.driver;
    });
  }

  function buildGlobalSummary(baseMetrics) {
    const list = toArray(baseMetrics);
    const totalBases = list.length;
    const totalExpedido = list.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalEntregue = list.reduce((sum, item) => sum + Number(item.entregue || 0), 0);
    const totalInsucesso = list.reduce((sum, item) => sum + Number(item.insucesso || 0), 0);
    const totalPendente = list.reduce((sum, item) => sum + Number(item.pendente || 0) + Number(item.naoEntregue || 0), 0);
    const deliveryRate = totalExpedido ? (totalEntregue / totalExpedido) * 100 : 0;
    return {
      totalBases,
      totalExpedido,
      totalEntregue,
      totalInsucesso,
      totalPendente,
      deliveryRate
    };
  }

  function aggregateBaseMetrics(items) {
    const grouped = {};
    toArray(items).forEach(function (item) {
      toArray(item.baseMetrics).forEach(function (metric) {
        const key = metric.base || "BASE INDEFINIDA";
        if (!grouped[key]) {
          grouped[key] = {
            base: key,
            regional: metric.regional || (Metrics.getRegionalFromBase ? Metrics.getRegionalFromBase(key) : "Não definida"),
            total: 0,
            entregue: 0,
            insucesso: 0,
            pendente: 0,
            naoEntregue: 0,
            taxa: 0
          };
        }
        grouped[key].total += Number(metric.total || 0);
        grouped[key].entregue += Number(metric.entregue || 0);
        grouped[key].insucesso += Number(metric.insucesso || 0);
        grouped[key].pendente += Number(metric.pendente || 0);
        grouped[key].naoEntregue += Number(metric.naoEntregue || 0);
      });
    });
    return Object.values(grouped).map(function (item) {
      item.taxa = item.total ? (item.entregue / item.total) * 100 : 0;
      return item;
    }).sort(function (a, b) {
      return (a.base || "").localeCompare(b.base || "", "pt-BR");
    });
  }

  function aggregateDrivers(items) {
    const grouped = {};
    toArray(items).forEach(function (item) {
      toArray(item.drivers).forEach(function (driver) {
        const key = [driver.base || "", driver.driver || ""].join("::");
        if (!grouped[key]) {
          grouped[key] = {
            base: driver.base || "",
            driver: driver.driver || "",
            total: 0,
            entregue: 0,
            insucesso: 0,
            pendente: 0,
            taxa: 0
          };
        }
        grouped[key].total += Number(driver.total || 0);
        grouped[key].entregue += Number(driver.entregue || 0);
        grouped[key].insucesso += Number(driver.insucesso || 0);
        grouped[key].pendente += Number(driver.pendente || 0);
      });
    });
    return Object.values(grouped).map(function (item) {
      item.taxa = item.total ? (item.entregue / item.total) * 100 : 0;
      return item;
    });
  }

  function buildSourceFromSnapshot(snapshot, fileItem, index) {
    const rows = toArray(fileItem && fileItem.rows);
    const baseMetrics = rows.length
      ? computeBaseMetricsFromRows(rows)
      : clone(toArray(fileItem && fileItem.baseMetrics).length ? fileItem.baseMetrics : snapshot.baseMetrics || []);
    const drivers = rows.length
      ? computeDriversFromRows(rows)
      : clone(toArray(fileItem && fileItem.drivers).length ? fileItem.drivers : snapshot.drivers || []);
    const summary = Object.assign(
      buildGlobalSummary(baseMetrics),
      clone(fileItem && fileItem.summary ? fileItem.summary : snapshot.summary || {})
    );
    summary.totalBases = Number(summary.totalBases || baseMetrics.length || 0);
    summary.totalExpedido = Number(summary.totalExpedido || 0);
    summary.totalEntregue = Number(summary.totalEntregue || 0);
    summary.totalInsucesso = Number(summary.totalInsucesso || 0);
    summary.totalPendente = Number(summary.totalPendente || 0);
    summary.deliveryRate = summary.totalExpedido ? (summary.totalEntregue / summary.totalExpedido) * 100 : Number(summary.deliveryRate || 0);

    const fileName = fileItem && fileItem.fileName ? fileItem.fileName : snapshot.fileNames && snapshot.fileNames[0] ? snapshot.fileNames[0] : `Lote ${index + 1}`;
    const chipNames = toArray(snapshot.fileNames).length ? snapshot.fileNames : [fileName];
    const shortLabel = buildSourceDisplayName(baseMetrics, extractSourceLabel(fileName), fileName);

    return {
      id: `${snapshot.id || safeId(snapshot.savedAt)}::${safeId(fileName)}::${index}`,
      snapshotId: snapshot.id,
      savedAt: fileItem && fileItem.savedAt ? fileItem.savedAt : snapshot.savedAt,
      lastUpdate: snapshot.lastUpdate || snapshot.savedAt,
      label: shortLabel,
      fileName: fileName,
      selectedSheetName: fileItem && fileItem.selectedSheetName ? fileItem.selectedSheetName : "",
      rowCount: Number(fileItem && fileItem.rowCount || snapshot.rowCount || 0),
      fileCount: Number(fileItem ? 1 : snapshot.fileCount || chipNames.length || 1),
      fileNames: fileItem ? [fileName] : chipNames,
      summary: summary,
      baseMetrics: baseMetrics,
      drivers: drivers
    };
  }

  function flattenSnapshotsToSources(snapshots) {
    const list = [];
    toArray(snapshots).forEach(function (snapshot) {
      const fileItems = toArray(snapshot.fileItems);
      if (fileItems.length) {
        fileItems.forEach(function (item, index) {
          list.push(buildSourceFromSnapshot(snapshot, item, index));
        });
      } else {
        list.push(buildSourceFromSnapshot(snapshot, null, 0));
      }
    });
    return list.sort(function (a, b) {
      return String(a.savedAt || "").localeCompare(String(b.savedAt || ""));
    });
  }

  async function loadSources() {
    const snapshots = await (Store.listSnapshots ? Store.listSnapshots() : Promise.resolve([]));
    state.allSources = flattenSnapshotsToSources(snapshots);
    applyFilters(true);
    updateSnapshotBadges();
  }

  function sourceMatchesFilters(source) {
    const search = normalizeText(state.filters.search || "");
    const base = state.filters.base || "all";
    const haystack = normalizeText([
      source.label,
      source.fileName,
      source.selectedSheetName,
      toArray(source.fileNames).join(" "),
      formatDate(source.savedAt)
    ].join(" "));
    const matchesSearch = !search || haystack.includes(search) || toArray(source.baseMetrics).some(function (metric) {
      return normalizeText(metric.base).includes(search);
    });
    const matchesBase = base === "all" || toArray(source.baseMetrics).some(function (metric) {
      return metric.base === base;
    });
    return matchesSearch && matchesBase;
  }

  function applyFilters(preserveSelection) {
    state.filteredSources = state.allSources.slice();

    if (!state.selectedIds.length && state.filteredSources.length) {
      state.selectedIds = state.filteredSources.map(function (item) { return item.id; });
    }

    if (preserveSelection) {
      const visibleIds = new Set(state.filteredSources.map(function (item) { return item.id; }));
      state.selectedIds = state.selectedIds.filter(function (id) { return visibleIds.has(id); });
      if (!state.selectedIds.length && state.filteredSources.length) {
        state.selectedIds = state.filteredSources.map(function (item) { return item.id; });
      }
    }

    renderSourceList();
    renderDashboard();
  }

  function getSelectedSources() {
    const selectedSet = new Set(state.selectedIds);
    const selected = state.allSources.filter(function (item) {
      return selectedSet.has(item.id);
    });
    if (!selected.length) return [];
    return selected.sort(function (a, b) {
      return String(a.savedAt || "").localeCompare(String(b.savedAt || ""));
    });
  }

  function updateSnapshotBadges() {
    U.setText("snapshotCountBadge", `${formatNumber(state.allSources.length)} relatório(s)`);
    U.setText("topSelectedCount", `${formatNumber(state.selectedIds.length)} selecionado(s)`);
  }

  function toggleSelection(id, checked) {
    const current = new Set(state.selectedIds);
    if (checked) current.add(id); else current.delete(id);
    state.selectedIds = Array.from(current);
    renderSourceList();
    renderDashboard();
  }

  function renderSourceList() {
    const list = U.byId("snapshotsList");
    const empty = U.byId("reportsEmpty");
    const badge = U.byId("topSelectedCount");
    const subtitle = U.byId("sourcesSubtitle");
    if (!list) return;

    U.toggleHidden(empty, state.filteredSources.length !== 0);
    if (badge) badge.textContent = `${formatNumber(state.selectedIds.length)} selecionado(s)`;

    list.innerHTML = state.filteredSources.map(function (source, index) {
      const checked = state.selectedIds.includes(source.id);
      const performance = Number(source.summary.deliveryRate || 0);
      const bases = toArray(source.baseMetrics);
      const baseNames = bases.slice(0, 2).map(function (b) { return b.base; }).join(", ");
      const moreBases = bases.length > 2 ? ` +${bases.length - 2}` : "";
      
      // Create operational label - prefer base names over file names
      const operationalLabel = buildSourceDisplayName(bases, source.label, source.fileName);
      
      return [
        `<article class="report-source-card${checked ? ' is-selected' : ''}" data-source-id="${escapeHtml(source.id)}">`,
        '<div class="report-source-head">',
        `<input class="report-source-check" type="checkbox" data-source-checkbox="${escapeHtml(source.id)}" ${checked ? 'checked' : ''} />`,
        '<div style="flex:1">',
        `<div class="report-source-title">${escapeHtml(operationalLabel)}</div>`,
        `<div class="text-soft" style="margin-top:4px; font-size:11px">${escapeHtml(formatDate(source.savedAt))}</div>`,
        '</div></div>',
        '<div class="report-source-meta">',
        `<span class="report-source-chip">${formatNumber(source.rowCount)} linhas</span>`,
        `<span class="report-source-chip">${formatNumber(source.summary.totalBases || 0)} base(s)</span>`,
        `<span class="report-source-chip sla-${getSlaColor(performance).class.split('-')[2]}">${formatPercent(performance, 1)}</span>`,
        '</div>',
        '</article>'
      ].join('');
    }).join('');

    // Update sources subtitle with base names
    if (subtitle && state.filteredSources.length > 0) {
      const allBases = [];
      state.filteredSources.forEach(function (source) {
        const bases = toArray(source.baseMetrics);
        bases.forEach(function (base) {
          if (!allBases.includes(base.base)) {
            allBases.push(base.base);
          }
        });
      });
      
      if (allBases.length > 0) {
        const baseDisplay = allBases.slice(0, 3).join(", ");
        const moreCount = allBases.length > 3 ? ` +${allBases.length - 3}` : "";
        subtitle.textContent = baseDisplay + moreCount;
      } else {
        subtitle.textContent = "Análise consolidada desses períodos";
      }
    }

    updateSnapshotBadges();
  }

  function buildAggregatedModel(selectedSources) {
    const baseMetrics = aggregateBaseMetrics(selectedSources);
    const drivers = aggregateDrivers(selectedSources);
    const summary = buildGlobalSummary(baseMetrics);
    const timeline = selectedSources.map(function (source, index) {
      return {
        label: source.label || buildSourceDisplayName(source.baseMetrics, `Etapa ${index + 1}`, source.fileName),
        savedAt: source.savedAt,
        total: Number(source.summary.totalExpedido || 0),
        entregue: Number(source.summary.totalEntregue || 0),
        insucesso: Number(source.summary.totalInsucesso || 0),
        pendente: Number(source.summary.totalPendente || 0),
        sla: Number(source.summary.deliveryRate || 0)
      };
    });
    return {
      sources: selectedSources,
      baseMetrics: baseMetrics,
      drivers: drivers,
      summary: summary,
      timeline: timeline,
      latestUpdate: selectedSources.length ? selectedSources[selectedSources.length - 1].savedAt : null
    };
  }

  function renderSummary(model) {
    const summary = model.summary;
    const bases = model.baseMetrics.slice();
    const best = bases.slice().sort(function (a, b) { return b.taxa - a.taxa; })[0];
    const worst = bases.slice().sort(function (a, b) { return a.taxa - b.taxa; })[0];
    const slaInfo = getSlaColor(summary.deliveryRate);

    // Create operational labels
    let executiveSubtitle = "Análise consolidada de períodos selecionados";
    if (model.sources.length === 1) {
      executiveSubtitle = `1 período analisado • ${summary.totalBases} base(s)`;
    } else if (model.sources.length > 1) {
      executiveSubtitle = `${model.sources.length} períodos consolidados • ${summary.totalBases} base(s) em análise`;
    }

    U.setText("executiveSubtitle", executiveSubtitle);

    // Update KPI cards
    U.setText("statSelectedSources", formatNumber(model.sources.length));
    U.setText("statSelectedRows", `${formatNumber(model.sources.length)} período(s) selecionado(s)`);
    U.setText("statTotalBases", formatNumber(summary.totalBases));
    U.setText("statBasesLabel", summary.totalBases === 1 ? "base na análise" : "bases na análise");
    U.setText("statTotalExpedido", formatNumber(summary.totalExpedido));
    U.setText("statExpedidoLabel", "total de itens");
    U.setText("statTotalEntregue", formatNumber(summary.totalEntregue));
    U.setText("statDeliveredRate", formatPercent(summary.deliveryRate, 2));
    U.setText("statTotalInsucesso", formatNumber(summary.totalInsucesso));
    U.setText("statPendenteTotal", `${formatNumber(summary.totalPendente)} pendência(s)`);
    U.setText("statSlaConsolidado", formatPercent(summary.deliveryRate, 1));
    U.setText("statSlaStatus", slaInfo.label);

    // Apply SLA status to main KPI card
    const slaCard = document.querySelector(".reports-kpi-card.kpi-featured");
    if (slaCard) {
      slaCard.className = `reports-kpi-card kpi-featured ${slaInfo.class}`;
    }

    // Update best/worst performers
    U.setText("bestBaseName", best ? best.base : "--");
    U.setText("bestBaseMeta", best ? `${formatNumber(best.entregue)} entregas • SLA ${formatPercent(best.taxa, 1)}` : "--");
    U.setText("worstBaseName", worst ? worst.base : "--");
    U.setText("worstBaseMeta", worst ? `${formatNumber(worst.insucesso)} insucessos • SLA ${formatPercent(worst.taxa, 1)}` : "--");
  }

  function renderInsights(model) {
    const container = U.byId("topInsights");
    if (!container) return;
    const bases = model.baseMetrics.slice();
    const worst = bases.slice().sort(function (a, b) {
      if (b.insucesso !== a.insucesso) return b.insucesso - a.insucesso;
      return a.taxa - b.taxa;
    })[0];
    const best = bases.slice().sort(function (a, b) {
      if (a.insucesso !== b.insucesso) return a.insucesso - b.insucesso;
      return b.taxa - a.taxa;
    })[0];
    let deltaTitle = "Selecione pelo menos 2 fontes.";
    let deltaSub = "Sem comparação de etapas ainda.";
    if (model.sources.length >= 2) {
      const compare = buildComparisonRows(model.sources[0], model.sources[model.sources.length - 1]);
      const biggest = compare.sort(function (a, b) {
        return Math.abs(b.deltaInsucesso) - Math.abs(a.deltaInsucesso) || Math.abs(b.deltaSla) - Math.abs(a.deltaSla);
      })[0];
      if (biggest) {
        deltaTitle = biggest.base;
        deltaSub = `${signed(biggest.deltaInsucesso)} insucessos • ${signed(biggest.deltaSla, 1)} p.p. de SLA`;
      }
    }
    container.innerHTML = [
      `<article class="insight-card"><small>Maior ofensor</small><strong>${escapeHtml(worst ? worst.base : '--')}</strong><span>${worst ? `${formatNumber(worst.insucesso)} insucessos • SLA ${formatPercent(worst.taxa, 1)}` : 'Aguardando seleção.'}</span></article>`,
      `<article class="insight-card"><small>Menor ofensor</small><strong>${escapeHtml(best ? best.base : '--')}</strong><span>${best ? `${formatNumber(best.insucesso)} insucessos • SLA ${formatPercent(best.taxa, 1)}` : 'Aguardando seleção.'}</span></article>`,
      `<article class="insight-card"><small>Maior mudança</small><strong>${escapeHtml(deltaTitle)}</strong><span>${escapeHtml(deltaSub)}</span></article>`
    ].join("");
  }

  function renderCriticalAlerts(model) {
    const container = U.byId("criticalAlerts");
    if (!container) return;

    const summary = model.summary;
    const alerts = [];

    // Alert 1: SLA below 90%
    if (summary.deliveryRate < 90) {
      alerts.push({
        severity: "critical",
        title: "SLA crítico",
        description: `Taxa de entrega ${formatPercent(summary.deliveryRate, 1)} está abaixo do limite aceitável (90%).`,
        action: "Revisar maiores ofensores"
      });
    }

    // Alert 2: High failure rate
    if (summary.totalExpedido > 0) {
      const failureRate = (summary.totalInsucesso / summary.totalExpedido) * 100;
      if (failureRate > 10) {
        alerts.push({
          severity: "warning",
          title: "Taxa de insucessos elevada",
          description: `${formatNumber(summary.totalInsucesso)} insucessos registrados (${formatPercent(failureRate, 1)}).`,
          action: "Analisar padrões de falha"
        });
      }
    }

    // Alert 3: Multiple bases with poor SLA
    const poorBases = model.baseMetrics.filter(function (b) { return b.taxa < 90; }).length;
    if (poorBases > 2) {
      alerts.push({
        severity: "warning",
        title: `${formatNumber(poorBases)} bases com SLA baixo`,
        description: `${formatNumber(poorBases)} base(s) operando com SLA abaixo de 90%.`,
        action: "Priorizar intervenção"
      });
    }

    // Alert 4: High pending rate
    if (summary.totalExpedido > 0) {
      const pendingRate = (summary.totalPendente / summary.totalExpedido) * 100;
      if (pendingRate > 15) {
        alerts.push({
          severity: "info",
          title: "Volume de pendências",
          description: `${formatNumber(summary.totalPendente)} itens pendentes (${formatPercent(pendingRate, 1)}).`,
          action: "Acompanhar progresso"
        });
      }
    }

    if (alerts.length === 0) {
      container.innerHTML = '<div class="alert-empty">✅ Nenhum alerta crítico detectado.</div>';
      return;
    }

    container.innerHTML = alerts.map(function (alert) {
      return [
        `<div class="alert-item alert-${alert.severity}">`,
        `<span class="alert-icon">${alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}</span>`,
        '<div class="alert-content">',
        `<strong>${escapeHtml(alert.title)}</strong>`,
        `<p>${escapeHtml(alert.description)}</p>`,
        `<span class="alert-action">${escapeHtml(alert.action)}</span>`,
        '</div></div>'
      ].join('');
    }).join('');
  }

  function getMetricValue(metric, kind) {
    if (kind === "entregue") return Number(metric.entregue || 0);
    if (kind === "insucesso") return Number(metric.insucesso || 0);
    if (kind === "pendente") return Number(metric.pendente || 0) + Number(metric.naoEntregue || 0);
    if (kind === "total") return Number(metric.total || 0);
    return Number(metric.taxa || 0);
  }

  function getMetricLabel(kind) {
    if (kind === "entregue") return "Entregues";
    if (kind === "insucesso") return "Insucessos";
    if (kind === "pendente") return "Pendências";
    if (kind === "total") return "Total expedido";
    return "SLA (%)";
  }

  function renderBaseChart(model) {
    const el = U.byId("baseChart");
    if (!el || !window.Plotly) return;
    const list = model.baseMetrics.slice().sort(function (a, b) {
      return b.taxa - a.taxa;
    });
    const x = list.map(function (item) { return item.base; });
    const y = list.map(function (item) { return Number(item.taxa || 0); });
    const text = list.map(function (item) {
      return [
        `<b>${escapeHtml(item.base)}</b>`,
        `SLA: ${formatPercent(item.taxa, 1)}`,
        `Entregues: ${formatNumber(item.entregue)}`,
        `Insucessos: ${formatNumber(item.insucesso)}`
      ].join("<br>");
    });
    Plotly.react(el, [{
      type: "bar",
      x: x,
      y: y,
      text: text,
      hovertemplate: "%{text}<extra></extra>",
      marker: { color: y, colorscale: "Reds" }
    }], {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#3b4256" },
      margin: { l: 50, r: 20, t: 20, b: 80 },
      yaxis: { title: "SLA (%)", gridcolor: "rgba(148,163,184,0.18)" },
      xaxis: { tickangle: -20 }
    }, { responsive: true, displaylogo: false });
  }

  function renderStatusChart(model) {
    const el = U.byId("statusChart");
    if (!el || !window.Plotly) return;
    const delivered = Number(model.summary.totalEntregue || 0);
    const failures = Number(model.summary.totalInsucesso || 0);
    const pending = Number(model.summary.totalPendente || 0);
    Plotly.react(el, [{
      type: "pie",
      labels: ["Entregues", "Insucessos", "Pendências"],
      values: [delivered, failures, pending],
      hole: 0.45,
      marker: { colors: ["#16a34a", "#dc2626", "#f59e0b"] },
      textinfo: "label+percent",
      hoverinfo: "label+value"
    }], {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#3b4256" },
      margin: { l: 20, r: 20, t: 20, b: 20 },
      showlegend: false
    }, { responsive: true, displaylogo: false });
  }

  function renderStageTimeline(model) {
    const container = U.byId("stageTimeline");
    if (!container) return;
    if (model.timeline.length === 0) {
      container.innerHTML = '<div class="empty-timeline">Selecione períodos para visualizar timeline</div>';
      return;
    }
    container.innerHTML = model.timeline.map(function (item, index) {
      const slaInfo = getSlaColor(item.sla);
      return [
        '<article class="stage-item">',
        '<div class="stage-item-inner">',
        `<h4>${index + 1}. ${escapeHtml(item.label)}</h4>`,
        `<p class="stage-date">${escapeHtml(formatDate(item.savedAt))}</p>`,
        '<div class="stage-tags">',
        `<span class="stage-tag sla-${slaInfo.class.split('-')[2]}" style="background:${slaInfo.color}20;color:${slaInfo.color}">SLA ${formatPercent(item.sla, 1)}</span>`,
        `<span class="stage-tag">${formatNumber(item.total)} expedidos</span>`,
        `<span class="stage-tag">${formatNumber(item.entregue)} ✓ entregues</span>`,
        `<span class="stage-tag error">${formatNumber(item.insucesso)} ✗ insucessos</span>`,
        `<span class="stage-tag pending">${formatNumber(item.pendente)} ⏳ pendências</span>`,
        '</div></div></article>'
      ].join('');
    }).join('');
  }

  function byBaseMap(source) {
    const map = {};
    toArray(source && source.baseMetrics).forEach(function (item) {
      map[item.base] = item;
    });
    return map;
  }

  function signed(value, digits) {
    const num = Number(value || 0);
    const formatted = (digits == null ? num.toFixed(0) : num.toFixed(digits));
    return `${num > 0 ? '+' : ''}${formatted}`;
  }

  function buildComparisonRows(first, last) {
    const firstMap = byBaseMap(first);
    const lastMap = byBaseMap(last);
    const allBases = Array.from(new Set(Object.keys(firstMap).concat(Object.keys(lastMap))));
    return allBases.map(function (base) {
      const a = firstMap[base] || {};
      const b = lastMap[base] || {};
      return {
        base: base,
        slaA: Number(a.taxa || 0),
        slaB: Number(b.taxa || 0),
        deltaSla: Number(b.taxa || 0) - Number(a.taxa || 0),
        entregueA: Number(a.entregue || 0),
        entregueB: Number(b.entregue || 0),
        deltaEntregue: Number(b.entregue || 0) - Number(a.entregue || 0),
        insucessoA: Number(a.insucesso || 0),
        insucessoB: Number(b.insucesso || 0),
        deltaInsucesso: Number(b.insucesso || 0) - Number(a.insucesso || 0)
      };
    }).sort(function (a, b) {
      return Math.abs(b.deltaInsucesso) - Math.abs(a.deltaInsucesso) || Math.abs(b.deltaSla) - Math.abs(a.deltaSla);
    });
  }

  function deltaClass(value, reverse) {
    if (value === 0) return "delta-neutral";
    const positiveIsGood = reverse ? value < 0 : value > 0;
    return positiveIsGood ? "delta-up" : "delta-down";
  }

  function renderComparisonChart(model) {
    const el = U.byId("comparisonChart");
    if (!el || !window.Plotly) return;
    const labels = model.sources.map(function (source, index) { return `#${index + 1} ${escapeHtml(buildSourceDisplayName(source.baseMetrics, source.label, source.fileName))}`; });
    const values = model.sources.map(function (source) { return Number(source.summary.deliveryRate || 0); });
    Plotly.react(el, [{
      type: "bar",
      x: labels,
      y: values,
      marker: { color: values.map(function (value) { return value > 85 ? '#16a34a' : value > 65 ? '#f59e0b' : '#dc2626'; }) },
      text: values.map(function (value) { return `${formatPercent(value, 1)}`; }),
      textposition: 'auto'
    }], {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#3b4256" },
      margin: { l: 50, r: 20, t: 40, b: 110 },
      yaxis: { title: "SLA (%)", range: [0, 100], gridcolor: "rgba(148,163,184,0.18)" },
      xaxis: { tickangle: -20 }
    }, { responsive: true, displaylogo: false });
  }

  function renderOffenders(model) {
    const container = U.byId("offendersTable");
    if (!container) return;
    const worst = model.baseMetrics.slice().sort(function (a, b) {
      if (b.insucesso !== a.insucesso) return b.insucesso - a.insucesso;
      return a.taxa - b.taxa;
    }).slice(0, 8);
    const best = model.baseMetrics.slice().sort(function (a, b) {
      if (a.insucesso !== b.insucesso) return a.insucesso - b.insucesso;
      return b.taxa - a.taxa;
    }).slice(0, 8);

    container.innerHTML = [
      '<div class="reports-rankings-row">',
      '<div class="rankings-column">',
      '<h4 class="rankings-subtitle">🔴 Maiores ofensores</h4>',
      '<div class="reports-table-wrap-x"><table class="mega-table mega-table-compact"><thead><tr><th>Base</th><th class="t-right">Insucessos</th><th class="t-right">Pendências</th><th class="t-right">SLA</th></tr></thead><tbody>',
      worst.map(function (item) {
        const slaInfo = getSlaColor(item.taxa);
        return `<tr><td><strong>${escapeHtml(item.base)}</strong></td><td class="t-right">${formatNumber(item.insucesso)}</td><td class="t-right">${formatNumber(Number(item.pendente || 0) + Number(item.naoEntregue || 0))}</td><td class="t-right ${slaInfo.class}"><strong>${formatPercent(item.taxa, 1)}</strong></td></tr>`;
      }).join('') || '<tr><td colspan="4" class="t-center">Sem dados.</td></tr>',
      '</tbody></table></div>',
      '</div>',
      '<div class="rankings-column">',
      '<h4 class="rankings-subtitle">⭐ Melhor desempenho</h4>',
      '<div class="reports-table-wrap-x"><table class="mega-table mega-table-compact"><thead><tr><th>Base</th><th class="t-right">Insucessos</th><th class="t-right">Pendências</th><th class="t-right">SLA</th></tr></thead><tbody>',
      best.map(function (item) {
        const slaInfo = getSlaColor(item.taxa);
        return `<tr><td><strong>${escapeHtml(item.base)}</strong></td><td class="t-right">${formatNumber(item.insucesso)}</td><td class="t-right">${formatNumber(Number(item.pendente || 0) + Number(item.naoEntregue || 0))}</td><td class="t-right ${slaInfo.class}"><strong>${formatPercent(item.taxa, 1)}</strong></td></tr>`;
      }).join('') || '<tr><td colspan="4" class="t-center">Sem dados.</td></tr>',
      '</tbody></table></div>',
      '</div>',
      '</div>'
    ].join('');
  }

  function renderBasesTable(model) {
    const container = U.byId("basesTable");
    if (!container) return;
    const rows = model.baseMetrics.slice().sort(function (a, b) {
      return b.total - a.total;
    });
    container.innerHTML = [
      '<div class="reports-table-wrap-x"><table class="mega-table mega-table-large"><thead><tr>',
      '<th>Base</th><th>Regional</th><th class="t-right">Total</th><th class="t-right">Entregues</th><th class="t-right">Insucessos</th><th class="t-right">Pendências</th><th class="t-right">SLA</th>',
      '</tr></thead><tbody>',
      rows.map(function (item) {
        const pendencias = Number(item.pendente || 0) + Number(item.naoEntregue || 0);
        const slaInfo = getSlaColor(item.taxa);
        return `<tr><td><strong>${escapeHtml(item.base)}</strong></td><td>${escapeHtml(item.regional || '-')}</td><td class="t-right">${formatNumber(item.total)}</td><td class="t-right">${formatNumber(item.entregue)}</td><td class="t-right">${formatNumber(item.insucesso)}</td><td class="t-right">${formatNumber(pendencias)}</td><td class="t-right"><span class="sla-badge ${slaInfo.class}">${formatPercent(item.taxa, 1)}</span></td></tr>`;
      }).join('') || '<tr><td colspan="7" class="t-center">Sem dados para a seleção atual.</td></tr>',
      '</tbody></table></div>'
    ].join('');
  }

  function renderEmptyDashboard() {
    renderSummary({ sources: [], summary: buildGlobalSummary([]), baseMetrics: [], latestUpdate: null });
    renderCriticalAlerts({ sources: [], summary: buildGlobalSummary([]), baseMetrics: [] });
    const empty = '<div class="empty-report-state">Selecione pelo menos um arquivo ou período para montar o relatório consolidado.</div>';
    U.setHtml("basesTable", empty);
    U.setHtml("offendersTable", empty);
    U.setHtml("stageTimeline", '');
    if (window.Plotly) {
      Plotly.purge(U.byId("baseChart"));
      Plotly.purge(U.byId("statusChart"));
    }
  }

  function renderDashboard() {
    const selected = getSelectedSources();
    if (!selected.length) {
      renderEmptyDashboard();
      clearMessage();
      return;
    }
    clearMessage();
    const model = buildAggregatedModel(selected);
    renderSummary(model);
    renderCriticalAlerts(model);
    renderStageTimeline(model);
    renderBaseChart(model);
    renderStatusChart(model);
    renderOffenders(model);
    renderBasesTable(model);
  }

  async function captureElement(targetId, preferredScale) {
    const el = U.byId(targetId);
    if (!el || !window.html2canvas) return null;
    const rect = el.getBoundingClientRect();
    const targetScale = preferredScale || 2;
    const scale = Math.max(targetScale, rect.width ? 3840 / rect.width : targetScale);
    return html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: Math.max(document.documentElement.clientWidth, el.scrollWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, el.scrollHeight),
      scrollX: 0,
      scrollY: -window.scrollY
    });
  }

  async function exportElementAsPng(targetId, filename) {
    const canvas = await captureElement(targetId, 2);
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    U.downloadBlobURL(url, filename || "relatorio.png");
  }

  async function exportElementAs4kPng(targetId, filename) {
    showMessage("Gerando relatório em alta resolução... Aguarde.", "info");
    const canvas = await captureElement(targetId, 3);
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    U.downloadBlobURL(url, filename || "relatorio-4k.png");
    showMessage("Relatório completo baixado com sucesso.", "success");
  }

  async function copyElementAsImage(targetId) {
    if (!navigator.clipboard || !window.ClipboardItem) return;
    showMessage("Preparando imagem completa para cópia... Aguarde.", "info");
    const canvas = await captureElement(targetId, 2);
    if (!canvas) return;
    return new Promise(function (resolve, reject) {
      canvas.toBlob(async function (blob) {
        if (!blob) {
          reject(new Error('Falha ao gerar imagem.'));
          return;
        }
        try {
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          showMessage("Relatório copiado para a área de transferência.", "success");
          resolve();
        } catch (error) {
          showMessage("Falha ao copiar. Tente a opção de download.", "error");
          reject(error);
        }
      });
    });
  }

  function bindEvents() {
    const selectAllBtn = U.byId("selectAllBtn");
    const clearSelectionBtn = U.byId("clearSelectionBtn");
    const refreshBtn = U.byId("refreshReportBtn");
    const copyBtn = U.byId("copyReportBtn");
    const downloadBtn = U.byId("downloadReportBtn");
    const list = U.byId("snapshotsList");
    const clearReportsBtn = U.byId("clearReportsBtn");

    if (refreshBtn) refreshBtn.addEventListener("click", function () {
      loadSources();
      showMessage("Dados atualizados com sucesso.", "success");
    });

    if (copyBtn) copyBtn.addEventListener("click", async function () {
      try {
        await copyElementAsImage("reportsExportArea");
      } catch (error) {
        console.error(error);
      }
    });

    if (downloadBtn) downloadBtn.addEventListener("click", async function () {
      try {
        await exportElementAs4kPng("reportsExportArea", "relatorio-consolidado-4k.png");
      } catch (error) {
        console.error(error);
        showMessage("Falha ao gerar download.", "error");
      }
    });

    if (selectAllBtn) selectAllBtn.addEventListener("click", function () {
      state.selectedIds = state.filteredSources.map(function (item) { return item.id; });
      renderSourceList();
      renderDashboard();
      showMessage(`${state.selectedIds.length} fonte(s) selecionada(s). Análise consolidada pronta.`, "success");
    });

    if (clearSelectionBtn) clearSelectionBtn.addEventListener("click", function () {
      state.selectedIds = [];
      renderSourceList();
      renderDashboard();
      showMessage("Seleção limpa. Marque os períodos que deseja analisar.", "info");
    });

    if (list) list.addEventListener("change", function (event) {
      const checkbox = event.target.closest("[data-source-checkbox]");
      if (!checkbox) return;
      toggleSelection(checkbox.getAttribute("data-source-checkbox"), checkbox.checked);
    });

    if (list) list.addEventListener("click", function (event) {
      const card = event.target.closest("[data-source-id]");
      if (!card || event.target.closest("input")) return;
      const id = card.getAttribute("data-source-id");
      const checked = !state.selectedIds.includes(id);
      toggleSelection(id, checked);
    });

    if (clearReportsBtn) clearReportsBtn.addEventListener("click", async function () {
      if (!Store.clearAllSnapshots) return;
      const confirmed = window.confirm("Deseja apagar todo o histórico de períodos salvos?");
      if (!confirmed) return;
      await Store.clearAllSnapshots();
      state.allSources = [];
      state.filteredSources = [];
      state.selectedIds = [];
      renderSourceList();
      renderDashboard();
      updateSnapshotBadges();
      showMessage("Histórico local apagado com sucesso.", "success");
    });

    // Collapse/Expand sources panel
    const collapseBtn = U.byId("collapseSources");
    const sourcesPanel = U.byId("sourcesPanel");
    if (collapseBtn && sourcesPanel) {
      // Load saved state
      const isSaved = localStorage.getItem("reports_sources_collapsed");
      if (isSaved === "true") {
        sourcesPanel.classList.add("is-collapsed");
      }

      collapseBtn.addEventListener("click", function () {
        sourcesPanel.classList.toggle("is-collapsed");
        const isNowCollapsed = sourcesPanel.classList.contains("is-collapsed");
        localStorage.setItem("reports_sources_collapsed", String(isNowCollapsed));
      });
    }
  }

  async function init() {
    bindEvents();
    try {
      await loadSources();
      if (!state.allSources.length) {
        showMessage("Nenhum arquivo/lote foi salvo ainda. Gere painéis no Dashboard para alimentar esta aba.", "info");
      }
    } catch (error) {
      console.error(error);
      showMessage(error.message || "Falha ao carregar o histórico local.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
