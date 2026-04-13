(function () {
  "use strict";

  const U = window.CTUtils;
  const Store = window.CTReportStore;
  const PlotlyLib = window.Plotly;

  const state = {
    allItems: [],
    items: [],
    selectedIds: [],
    openedId: null,
    comparisonModel: null
  };

  function byId(id) {
    return U.byId(id);
  }

  function formatInputDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function parseDateTimeInput(id) {
    const el = byId(id);
    if (!el || !el.value) return null;
    const d = new Date(el.value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function getSlaToneClass(value) {
    const num = Number(value || 0);
    if (num >= 95) return "success";
    if (num >= 90) return "warning";
    return "danger";
  }

  function getSlaLabel(value) {
    const tone = getSlaToneClass(value);
    if (tone === "success") return "Dentro da meta";
    if (tone === "warning") return "Faixa de atenção";
    return "Crítico";
  }

  function getSlaCardClass(value) {
    return "tone-" + getSlaToneClass(value) + "-card";
  }

  function diffClass(value, inverse) {
    const num = Number(value || 0);
    if (num === 0) return "neutral";
    const good = inverse ? num < 0 : num > 0;
    return good ? "positive" : "negative";
  }

  function formatSigned(value, formatter) {
    const num = Number(value || 0);
    const text = formatter ? formatter(Math.abs(num)) : U.formatNumber(Math.abs(num));
    return (num > 0 ? "+" : num < 0 ? "-" : "") + text;
  }

  function sortBySavedAtDesc(list) {
    return (list || []).slice().sort(function (a, b) {
      return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
    });
  }

  function getFilters() {
    return {
      start: parseDateTimeInput("startDateTime"),
      end: parseDateTimeInput("endDateTime"),
      base: byId("reportBaseFilter") ? byId("reportBaseFilter").value : "all",
      search: byId("reportSearch") ? byId("reportSearch").value.trim() : ""
    };
  }

  function getMetricForBase(snapshot, base) {
    if (!snapshot || !base || base === "all") return null;
    return (snapshot.baseMetrics || []).find(function (item) { return item.base === base; }) || null;
  }

  function getSnapshotStats(snapshot, baseFilter) {
    if (!snapshot) {
      return {
        totalBases: 0,
        totalExpedido: 0,
        totalEntregue: 0,
        totalPendente: 0,
        totalInsucesso: 0,
        deliveryRate: 0
      };
    }

    if (!baseFilter || baseFilter === "all") {
      return Object.assign({
        totalBases: Number(snapshot.summary && snapshot.summary.totalBases || 0),
        totalExpedido: 0,
        totalEntregue: 0,
        totalPendente: 0,
        totalInsucesso: 0,
        deliveryRate: 0
      }, snapshot.summary || {});
    }

    const metric = getMetricForBase(snapshot, baseFilter);
    if (!metric) {
      return {
        totalBases: 0,
        totalExpedido: 0,
        totalEntregue: 0,
        totalPendente: 0,
        totalInsucesso: 0,
        deliveryRate: 0
      };
    }

    return {
      totalBases: 1,
      totalExpedido: Number(metric.total || 0),
      totalEntregue: Number(metric.entregue || 0),
      totalPendente: Number(metric.pendente || 0) + Number(metric.naoEntregue || 0),
      totalInsucesso: Number(metric.insucesso || 0),
      deliveryRate: Number(metric.taxa || 0)
    };
  }

  function getBases(snapshot) {
    return (snapshot && snapshot.baseMetrics ? snapshot.baseMetrics : []).slice();
  }

  function getBestBase(snapshot) {
    return getBases(snapshot).slice().sort(function (a, b) {
      if ((b.taxa || 0) !== (a.taxa || 0)) return (b.taxa || 0) - (a.taxa || 0);
      return (b.total || 0) - (a.total || 0);
    })[0] || null;
  }

  function getWorstBase(snapshot) {
    return getBases(snapshot).slice().sort(function (a, b) {
      if ((a.taxa || 0) !== (b.taxa || 0)) return (a.taxa || 0) - (b.taxa || 0);
      return (b.insucesso || 0) - (a.insucesso || 0);
    })[0] || null;
  }

  function getWorstDriver(snapshot) {
    return (snapshot && snapshot.drivers ? snapshot.drivers : []).slice().sort(function (a, b) {
      if ((a.taxa || 0) !== (b.taxa || 0)) return (a.taxa || 0) - (b.taxa || 0);
      return (b.total || 0) - (a.total || 0);
    })[0] || null;
  }

  function updateHeaderBadges(items) {
    U.setText("reportsCountBadge", "Snapshots: " + U.formatNumber(items.length));
    U.setText("reportsLastBadge", items[0] ? ("Último snapshot: " + U.formatDateTimeBR(items[0].savedAt)) : "Último snapshot: --");
  }

  function renderStats(items) {
    const latest = items[0] || null;
    const baseFilter = getFilters().base;
    const maxTotal = items.reduce(function (acc, item) {
      const total = Number(getSnapshotStats(item, baseFilter).totalExpedido || 0);
      return total > acc ? total : acc;
    }, 0);
    const avgSla = items.length ? items.reduce(function (acc, item) {
      return acc + Number(getSnapshotStats(item, baseFilter).deliveryRate || 0);
    }, 0) / items.length : 0;

    U.setText("statSnapshots", U.formatNumber(items.length));
    U.setText("statLatestTime", latest ? U.formatDateTimeBR(latest.savedAt) : "--");
    U.setText("statMaxTotal", U.formatNumber(maxTotal));
    U.setText("statLatestBases", latest ? U.formatNumber(getSnapshotStats(latest, baseFilter).totalBases || 0) : "0");
    U.setText("statAverageSla", U.formatPercent(avgSla, 2));
  }

  function populateBaseFilter(items) {
    const select = byId("reportBaseFilter");
    if (!select) return;
    const current = select.value || "all";
    const bases = Array.from(new Set(items.flatMap(function (item) {
      return (item.baseMetrics || []).map(function (metric) { return metric.base; });
    }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });

    select.innerHTML = '<option value="all">Todas as bases</option>' + bases.map(function (base) {
      return '<option value="' + U.escapeHtml(base) + '">' + U.escapeHtml(base) + '</option>';
    }).join("");

    if (bases.includes(current)) select.value = current;
  }

  function reportRowHtml(item) {
    const summary = getSnapshotStats(item, getFilters().base);
    const tone = getSlaToneClass(summary.deliveryRate);
    const checked = state.selectedIds.includes(item.id) ? "checked" : "";
    const opened = state.openedId === item.id ? "is-opened" : "";

    return [
      '<article class="report-row tone-' + tone + ' ' + opened + '" data-report-id="' + U.escapeHtml(item.id) + '">',
      '<div class="report-row-check">',
      '<label class="report-check-chip"><input type="checkbox" class="report-select" data-report-id="' + U.escapeHtml(item.id) + '" ' + checked + ' /></label>',
      '<span>Comparar</span>',
      '</div>',
      '<div class="report-row-main">',
      '<div class="report-row-title">' + U.escapeHtml(U.formatDateTimeBR(item.savedAt)) + '</div>',
      '<div class="report-row-subtitle">' + U.formatNumber(item.fileCount || 0) + ' arquivo(s) • ' + U.formatNumber(item.rowCount || 0) + ' linha(s) • ' + U.formatNumber(summary.totalBases || 0) + ' base(s)</div>',
      '<div class="report-row-meta">',
      '<span class="report-pill">Expedido: ' + U.formatNumber(summary.totalExpedido || 0) + '</span>',
      '<span class="report-pill">Entregues: ' + U.formatNumber(summary.totalEntregue || 0) + '</span>',
      '<span class="report-pill">Insucesso: ' + U.formatNumber(summary.totalInsucesso || 0) + '</span>',
      '<span class="report-pill sla-pill-' + tone + '">SLA: ' + U.formatPercent(summary.deliveryRate || 0, 2) + '</span>',
      '</div>',
      '</div>',
      '<div class="report-row-actions">',
      '<button class="btn-secondary report-open-btn" type="button" data-report-id="' + U.escapeHtml(item.id) + '">Abrir</button>',
      '<button class="btn-secondary report-delete-btn" type="button" data-report-id="' + U.escapeHtml(item.id) + '">Excluir</button>',
      '</div>',
      '</article>'
    ].join("");
  }

  function renderList(items) {
    const list = byId("reportsList");
    if (!list) return;
    list.innerHTML = items.map(reportRowHtml).join("");
    U.toggleHidden("reportsEmpty", items.length > 0);
  }

  function metricCardHtml(title, value, toneClass, subtitle) {
    return [
      '<article class="card summary-card report-summary-card ' + (toneClass || '') + '">',
      '<h4>' + U.escapeHtml(title) + '</h4>',
      '<strong>' + U.escapeHtml(value) + '</strong>',
      subtitle ? '<span class="summary-caption">' + U.escapeHtml(subtitle) + '</span>' : '',
      '</article>'
    ].join("");
  }

  function basesTableHtml(bases) {
    const rows = (bases || []).slice().sort(function (a, b) {
      return (b.total || 0) - (a.total || 0);
    }).map(function (item) {
      return [
        '<tr>',
        '<td>' + U.escapeHtml(item.base || '-') + '</td>',
        '<td>' + U.escapeHtml(item.regional || '-') + '</td>',
        '<td class="t-right">' + U.formatNumber(item.total || 0) + '</td>',
        '<td class="t-right">' + U.formatNumber(item.entregue || 0) + '</td>',
        '<td class="t-right">' + U.formatNumber(item.insucesso || 0) + '</td>',
        '<td class="t-right">' + U.formatNumber((item.pendente || 0) + (item.naoEntregue || 0)) + '</td>',
        '<td class="t-right"><span class="hero-tag compact-tag sla-pill-' + getSlaToneClass(item.taxa || 0) + '">' + U.formatPercent(item.taxa || 0, 2) + '</span></td>',
        '</tr>'
      ].join("");
    }).join("");

    return [
      '<div class="table-scroll report-table-scroll">',
      '<table>',
      '<thead><tr><th>Base</th><th>Regional</th><th class="t-right">Expedido</th><th class="t-right">Entregues</th><th class="t-right">Insucesso</th><th class="t-right">Pendências</th><th class="t-right">SLA</th></tr></thead>',
      '<tbody>' + (rows || '<tr><td colspan="7" class="text-soft">Sem bases neste snapshot.</td></tr>') + '</tbody>',
      '</table>',
      '</div>'
    ].join("");
  }

  function driversTableHtml(drivers) {
    const rows = (drivers || []).slice().sort(function (a, b) {
      if ((a.taxa || 0) !== (b.taxa || 0)) return (a.taxa || 0) - (b.taxa || 0);
      return (b.total || 0) - (a.total || 0);
    }).slice(0, 12).map(function (item) {
      return [
        '<tr>',
        '<td>' + U.escapeHtml(item.driver || '-') + '</td>',
        '<td>' + U.escapeHtml(item.base || '-') + '</td>',
        '<td class="t-right">' + U.formatNumber(item.total || 0) + '</td>',
        '<td class="t-right">' + U.formatNumber(item.insucesso || 0) + '</td>',
        '<td class="t-right"><span class="hero-tag compact-tag sla-pill-' + getSlaToneClass(item.taxa || 0) + '">' + U.formatPercent(item.taxa || 0, 2) + '</span></td>',
        '</tr>'
      ].join("");
    }).join("");

    return [
      '<div class="table-scroll report-table-scroll">',
      '<table>',
      '<thead><tr><th>Motorista</th><th>Base</th><th class="t-right">Total</th><th class="t-right">Insucesso</th><th class="t-right">SLA</th></tr></thead>',
      '<tbody>' + (rows || '<tr><td colspan="5" class="text-soft">Sem motoristas para exibir.</td></tr>') + '</tbody>',
      '</table>',
      '</div>'
    ].join("");
  }

  function buildReportSvg(snapshot) {
    const summary = getSnapshotStats(snapshot, getFilters().base);
    const best = getBestBase(snapshot);
    const worst = getWorstBase(snapshot);
    const driver = getWorstDriver(snapshot);
    const tone = getSlaToneClass(summary.deliveryRate);
    const fill = tone === "success" ? "#effaf2" : tone === "warning" ? "#fff7e8" : "#fff1f1";
    const stroke = tone === "success" ? "#16a34a" : tone === "warning" ? "#f59e0b" : "#dc2626";

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">',
      '<rect width="1600" height="900" fill="#eff3f8"/>',
      '<rect x="36" y="36" width="1528" height="828" rx="28" fill="#ffffff" stroke="#dbe3ef"/>',
      '<text x="70" y="104" font-size="44" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">Relatório salvo em ' + U.escapeHtml(U.formatDateTimeBR(snapshot.savedAt)) + '</text>',
      '<text x="70" y="144" font-size="22" font-family="Segoe UI, Arial" fill="#6b7a90">' + U.escapeHtml(U.formatNumber(snapshot.fileCount || 0)) + ' arquivo(s) • ' + U.escapeHtml(U.formatNumber(snapshot.rowCount || 0)) + ' linha(s) • Referência ' + U.escapeHtml(snapshot.referenceDate || '-') + '</text>',
      '<rect x="1275" y="68" width="230" height="48" rx="24" fill="#fff6f6" stroke="#f2c3c3"/>',
      '<text x="1298" y="98" font-size="20" font-family="Segoe UI, Arial" font-weight="700" fill="#b91c1c">Assinatura: ' + U.escapeHtml(snapshot.signature || '-') + '</text>',
      '<rect x="70" y="186" width="1460" height="88" rx="20" fill="' + fill + '" stroke="' + stroke + '"/>',
      '<text x="96" y="238" font-size="32" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">Faixa operacional: ' + U.escapeHtml(getSlaLabel(summary.deliveryRate)) + '</text>',
      '<text x="96" y="266" font-size="20" font-family="Segoe UI, Arial" fill="#54647d">SLA geral em ' + U.escapeHtml(U.formatPercent(summary.deliveryRate, 2)) + ' nesta captura</text>',
      '<g>',
      metricSvgBlock(70, 310, 'Total de bases', U.formatNumber(summary.totalBases || 0)),
      metricSvgBlock(370, 310, 'Total expedido', U.formatNumber(summary.totalExpedido || 0)),
      metricSvgBlock(670, 310, 'Entregues', U.formatNumber(summary.totalEntregue || 0)),
      metricSvgBlock(970, 310, 'Pendências', U.formatNumber(summary.totalPendente || 0)),
      metricSvgBlock(1270, 310, 'Insucesso', U.formatNumber(summary.totalInsucesso || 0)),
      metricSvgBlock(70, 490, 'Taxa de entrega', U.formatPercent(summary.deliveryRate || 0, 2)),
      metricSvgBlock(370, 490, 'Melhor base', best ? best.base : '-', best ? ('SLA ' + U.formatPercent(best.taxa || 0, 2)) : ''),
      metricSvgBlock(670, 490, 'Base em atenção', worst ? worst.base : '-', worst ? ('SLA ' + U.formatPercent(worst.taxa || 0, 2)) : ''),
      metricSvgBlock(970, 490, 'Motorista com menor SLA', driver ? driver.driver : '-', driver ? ('SLA ' + U.formatPercent(driver.taxa || 0, 2)) : ''),
      metricSvgBlock(1270, 490, 'Arquivos do lote', U.formatNumber(snapshot.fileCount || 0), (snapshot.fileNames || [])[0] || ''),
      '</g>',
      '<text x="70" y="738" font-size="30" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">Top bases do snapshot</text>',
      (snapshot.baseMetrics || []).slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); }).slice(0, 6).map(function (item, index) {
        const y = 774 + (index * 18);
        return '<text x="70" y="' + y + '" font-size="20" font-family="Segoe UI, Arial" fill="#4a5a73">• ' + U.escapeHtml(item.base || '-') + ' — SLA ' + U.escapeHtml(U.formatPercent(item.taxa || 0, 2)) + ' — Expedidos ' + U.escapeHtml(U.formatNumber(item.total || 0)) + '</text>';
      }).join(''),
      '</svg>'
    ].join('');
  }

  function metricSvgBlock(x, y, label, value, subtitle) {
    return [
      '<rect x="' + x + '" y="' + y + '" width="260" height="136" rx="20" fill="#f8fbff" stroke="#dce6f2"/>',
      '<text x="' + (x + 20) + '" y="' + (y + 36) + '" font-size="18" font-family="Segoe UI, Arial" font-weight="700" fill="#7a869b">' + U.escapeHtml(label) + '</text>',
      '<text x="' + (x + 20) + '" y="' + (y + 88) + '" font-size="46" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">' + U.escapeHtml(value) + '</text>',
      subtitle ? '<text x="' + (x + 20) + '" y="' + (y + 112) + '" font-size="18" font-family="Segoe UI, Arial" fill="#54647d">' + U.escapeHtml(subtitle) + '</text>' : ''
    ].join('');
  }

  function renderReportViewer(snapshot) {
    const shell = byId("reportViewer");
    if (!shell || !snapshot) return;

    const summary = getSnapshotStats(snapshot, getFilters().base);
    const best = getBestBase(snapshot);
    const worst = getWorstBase(snapshot);
    const worstDriver = getWorstDriver(snapshot);

    shell.className = "report-viewer-shell";
    shell.innerHTML = [
      '<section id="reportViewerExport" class="report-export-surface">',
      '<div class="viewer-hero-row">',
      '<div>',
      '<h2 class="viewer-title">Relatório salvo em ' + U.escapeHtml(U.formatDateTimeBR(snapshot.savedAt)) + '</h2>',
      '<div class="report-row-subtitle">' + U.formatNumber(snapshot.fileCount || 0) + ' arquivo(s) • ' + U.formatNumber(snapshot.rowCount || 0) + ' linha(s) • Referência ' + U.escapeHtml(snapshot.referenceDate || '-') + '</div>',
      '</div>',
      '<div class="viewer-top-actions">',
      '<span class="report-pill">Assinatura: ' + U.escapeHtml(snapshot.signature || '-') + '</span>',
      '<span class="report-pill sla-pill-' + getSlaToneClass(summary.deliveryRate) + '">' + getSlaLabel(summary.deliveryRate) + '</span>',
      '</div>',
      '</div>',
      '<section class="summary-grid reports-summary-grid inline-summary-grid">',
      metricCardHtml('Total de bases', U.formatNumber(summary.totalBases || 0), ''),
      metricCardHtml('Total expedido', U.formatNumber(summary.totalExpedido || 0), ''),
      metricCardHtml('Entregues', U.formatNumber(summary.totalEntregue || 0), ''),
      metricCardHtml('Pendências', U.formatNumber(summary.totalPendente || 0), ''),
      metricCardHtml('Insucesso', U.formatNumber(summary.totalInsucesso || 0), ''),
      metricCardHtml('Taxa de entrega', U.formatPercent(summary.deliveryRate || 0, 2), getSlaCardClass(summary.deliveryRate), getSlaLabel(summary.deliveryRate)),
      '</section>',
      '<section class="report-insights-grid">',
      '<article class="report-insight ' + getSlaCardClass(summary.deliveryRate) + '"><small>Faixa operacional</small><strong>' + U.escapeHtml(getSlaLabel(summary.deliveryRate)) + '</strong><span>SLA geral em ' + U.escapeHtml(U.formatPercent(summary.deliveryRate || 0, 2)) + ' nesta captura.</span></article>',
      '<article class="report-insight"><small>Melhor base</small><strong>' + U.escapeHtml(best ? best.base : '-') + '</strong><span>' + (best ? ('SLA ' + U.formatPercent(best.taxa || 0, 2) + ' • ' + U.formatNumber(best.total || 0) + ' expedidos') : 'Sem base para exibir') + '</span></article>',
      '<article class="report-insight"><small>Base em atenção</small><strong>' + U.escapeHtml(worst ? worst.base : '-') + '</strong><span>' + (worst ? ('SLA ' + U.formatPercent(worst.taxa || 0, 2) + ' • ' + U.formatNumber(worst.insucesso || 0) + ' insucessos') : 'Sem base crítica nesta captura') + '</span></article>',
      '<article class="report-insight"><small>Motorista com menor SLA</small><strong>' + U.escapeHtml(worstDriver ? worstDriver.driver : '-') + '</strong><span>' + (worstDriver ? (U.escapeHtml(worstDriver.base || '-') + ' • SLA ' + U.formatPercent(worstDriver.taxa || 0, 2)) : 'Sem ranking de motoristas') + '</span></article>',
      '<article class="report-insight"><small>Arquivos do lote</small><strong>' + U.escapeHtml(U.formatNumber(snapshot.fileCount || 0)) + '</strong><span>' + U.escapeHtml((snapshot.fileNames || [])[0] || 'Nenhum arquivo registrado') + '</span></article>',
      '<article class="report-insight"><small>Assinatura do snapshot</small><strong>' + U.escapeHtml(snapshot.signature || '-') + '</strong><span>Identificador único para evitar duplicidade do lote.</span></article>',
      '</section>',
      '<section class="reports-viewer-grid">',
      '<article class="card report-inner-card"><div class="section-header"><h3>Bases do snapshot</h3><span class="text-soft">Classificação por volume</span></div>' + basesTableHtml(snapshot.baseMetrics || []) + '</article>',
      '<article class="card report-inner-card"><div class="section-header"><h3>Motoristas com menor SLA</h3><span class="text-soft">Top 12 em atenção</span></div>' + driversTableHtml(snapshot.drivers || []) + '</article>',
      '</section>',
      '<article class="card report-inner-card"><div class="section-header"><h3>Arquivos processados</h3><span class="text-soft">Lote salvo no histórico local</span></div><div class="report-files-box">' + (snapshot.fileNames || []).map(function (file) {
        return '<div class="report-file-item">' + U.escapeHtml(file) + '</div>';
      }).join('') + '</div></article>',
      '</section>'
    ].join("");
  }

  async function openSnapshot(id) {
    const snapshot = await Store.getSnapshotById(id);
    if (!snapshot) {
      U.showMessage("reportsMessage", "Não foi possível abrir o snapshot selecionado.", "warning");
      return;
    }
    state.openedId = id;
    renderList(state.items);
    renderReportViewer(snapshot);
  }

  function getWindowSnapshots(startIso, endIso) {
    const start = startIso ? new Date(startIso).getTime() : null;
    const end = endIso ? new Date(endIso).getTime() : null;
    return sortBySavedAtDesc(state.allItems.filter(function (item) {
      const when = new Date(item.savedAt).getTime();
      if (start && when < start) return false;
      if (end && when > end) return false;
      const base = getFilters().base;
      if (base !== "all") return Boolean(getMetricForBase(item, base));
      return true;
    })).reverse();
  }

  function buildPeriodModel(label, snapshots) {
    const representative = snapshots[snapshots.length - 1] || null;
    const first = snapshots[0] || representative;
    const last = representative;
    const firstStats = getSnapshotStats(first, getFilters().base);
    const lastStats = getSnapshotStats(last, getFilters().base);
    return {
      label: label,
      snapshots: snapshots,
      representative: representative,
      first: first,
      last: last,
      stats: lastStats,
      changeInsideWindow: {
        totalExpedido: Number(lastStats.totalExpedido || 0) - Number(firstStats.totalExpedido || 0),
        totalEntregue: Number(lastStats.totalEntregue || 0) - Number(firstStats.totalEntregue || 0),
        totalPendente: Number(lastStats.totalPendente || 0) - Number(firstStats.totalPendente || 0),
        totalInsucesso: Number(lastStats.totalInsucesso || 0) - Number(firstStats.totalInsucesso || 0),
        deliveryRate: Number(lastStats.deliveryRate || 0) - Number(firstStats.deliveryRate || 0)
      }
    };
  }

  function buildDiffRows(snapshotA, snapshotB) {
    const baseFilter = getFilters().base;
    const onlyChanged = byId("compareChangedOnly") ? byId("compareChangedOnly").checked : true;

    const basesA = baseFilter === "all" ? (snapshotA.baseMetrics || []) : [getMetricForBase(snapshotA, baseFilter)].filter(Boolean);
    const basesB = baseFilter === "all" ? (snapshotB.baseMetrics || []) : [getMetricForBase(snapshotB, baseFilter)].filter(Boolean);
    const baseNames = Array.from(new Set([].concat(basesA.map(function (x) { return x.base; }), basesB.map(function (x) { return x.base; })))).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });

    return baseNames.map(function (baseName) {
      const a = basesA.find(function (item) { return item.base === baseName; }) || {};
      const b = basesB.find(function (item) { return item.base === baseName; }) || {};
      const delta = {
        total: Number(b.total || 0) - Number(a.total || 0),
        entregue: Number(b.entregue || 0) - Number(a.entregue || 0),
        insucesso: Number(b.insucesso || 0) - Number(a.insucesso || 0),
        pendente: (Number(b.pendente || 0) + Number(b.naoEntregue || 0)) - (Number(a.pendente || 0) + Number(a.naoEntregue || 0)),
        taxa: Number(b.taxa || 0) - Number(a.taxa || 0)
      };
      const changedKeys = Object.keys(delta).filter(function (key) { return Number(delta[key] || 0) !== 0; });
      return {
        base: baseName,
        regional: b.regional || a.regional || '-',
        a: a,
        b: b,
        delta: delta,
        changedKeys: changedKeys,
        onlyBaixas: changedKeys.length > 0 && changedKeys.every(function (key) { return key === 'entregue' || key === 'pendente'; })
      };
    }).filter(function (row) {
      return onlyChanged ? row.changedKeys.length > 0 : true;
    });
  }

  function buildComparisonModel(title, labelA, labelB, snapshotA, snapshotB, meta) {
    const statsA = getSnapshotStats(snapshotA, getFilters().base);
    const statsB = getSnapshotStats(snapshotB, getFilters().base);
    const deltas = {
      totalExpedido: Number(statsB.totalExpedido || 0) - Number(statsA.totalExpedido || 0),
      totalEntregue: Number(statsB.totalEntregue || 0) - Number(statsA.totalEntregue || 0),
      totalPendente: Number(statsB.totalPendente || 0) - Number(statsA.totalPendente || 0),
      totalInsucesso: Number(statsB.totalInsucesso || 0) - Number(statsA.totalInsucesso || 0),
      deliveryRate: Number(statsB.deliveryRate || 0) - Number(statsA.deliveryRate || 0)
    };
    const rows = buildDiffRows(snapshotA, snapshotB);
    const relevantHighlights = [];

    if (deltas.totalEntregue !== 0 && deltas.totalInsucesso === 0 && deltas.deliveryRate === 0) {
      relevantHighlights.push('A principal mudança foi no volume de baixas/entregas.');
    }
    if (deltas.totalInsucesso !== 0) {
      relevantHighlights.push('Houve alteração nos insucessos entre os períodos.');
    }
    if (deltas.deliveryRate !== 0) {
      relevantHighlights.push('O SLA mudou entre os períodos analisados.');
    }
    if (!relevantHighlights.length) {
      relevantHighlights.push('Os períodos estão muito parecidos; quase não houve mudança operacional relevante.');
    }

    return {
      title: title,
      labelA: labelA,
      labelB: labelB,
      snapshotA: snapshotA,
      snapshotB: snapshotB,
      statsA: statsA,
      statsB: statsB,
      deltas: deltas,
      rows: rows,
      highlights: relevantHighlights,
      meta: meta || {}
    };
  }

  function deltaCardHtml(title, valueA, valueB, delta, type, inverse) {
    const formatter = type === 'percent'
      ? function (v) { return U.formatPercent(v, 2); }
      : function (v) { return U.formatNumber(v); };
    const deltaText = formatSigned(delta, formatter);
    return [
      '<article class="card summary-card comparison-metric-card">',
      '<h4>' + U.escapeHtml(title) + '</h4>',
      '<div class="comparison-values"><span>' + U.escapeHtml(valueA) + '</span><span>→</span><span>' + U.escapeHtml(valueB) + '</span></div>',
      '<strong class="comparison-delta ' + diffClass(delta, inverse) + '">' + U.escapeHtml(deltaText) + '</strong>',
      '</article>'
    ].join('');
  }

  function diffTableHtml(rows) {
    const body = rows.map(function (row) {
      return [
        '<tr class="' + (row.onlyBaixas ? 'row-focus-low' : 'row-focus-high') + '">',
        '<td><strong>' + U.escapeHtml(row.base || '-') + '</strong><div class="cell-subtitle">' + U.escapeHtml(row.regional || '-') + '</div></td>',
        '<td class="t-right">' + U.formatNumber(row.a.total || 0) + '</td>',
        '<td class="t-right">' + U.formatNumber(row.b.total || 0) + '</td>',
        '<td class="t-right comparison-delta ' + diffClass(row.delta.entregue, false) + '">' + formatSigned(row.delta.entregue, function (v) { return U.formatNumber(v); }) + '</td>',
        '<td class="t-right comparison-delta ' + diffClass(row.delta.insucesso, true) + '">' + formatSigned(row.delta.insucesso, function (v) { return U.formatNumber(v); }) + '</td>',
        '<td class="t-right comparison-delta ' + diffClass(row.delta.pendente, true) + '">' + formatSigned(row.delta.pendente, function (v) { return U.formatNumber(v); }) + '</td>',
        '<td class="t-right comparison-delta ' + diffClass(row.delta.taxa, false) + '">' + formatSigned(row.delta.taxa, function (v) { return U.formatPercent(v, 2); }) + '</td>',
        '<td><span class="report-pill ' + (row.onlyBaixas ? 'pill-soft-info' : 'pill-soft-danger') + '">' + (row.onlyBaixas ? 'Mudou sobretudo em baixas' : 'Mudança multi-KPI') + '</span></td>',
        '</tr>'
      ].join('');
    }).join('');

    return [
      '<div class="table-scroll comparison-table-scroll">',
      '<table>',
      '<thead><tr><th>Base</th><th class="t-right">Exp. A</th><th class="t-right">Exp. B</th><th class="t-right">Δ Entregues</th><th class="t-right">Δ Insucesso</th><th class="t-right">Δ Pendências</th><th class="t-right">Δ SLA</th><th>Sinal</th></tr></thead>',
      '<tbody>' + (body || '<tr><td colspan="8" class="text-soft">Nenhuma base alterada para os filtros atuais.</td></tr>') + '</tbody>',
      '</table>',
      '</div>'
    ].join('');
  }

  function buildComparisonSvg(model) {
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">',
      '<rect width="1600" height="960" fill="#eff3f8"/>',
      '<rect x="32" y="32" width="1536" height="896" rx="28" fill="#ffffff" stroke="#dbe3ef"/>',
      '<text x="72" y="100" font-size="42" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">' + U.escapeHtml(model.title) + '</text>',
      '<text x="72" y="138" font-size="22" font-family="Segoe UI, Arial" fill="#5b6b82">' + U.escapeHtml(model.labelA) + ' vs ' + U.escapeHtml(model.labelB) + '</text>',
      comparisonMetricSvg(72, 182, 'Expedido', model.statsA.totalExpedido, model.statsB.totalExpedido, model.deltas.totalExpedido),
      comparisonMetricSvg(392, 182, 'Entregues', model.statsA.totalEntregue, model.statsB.totalEntregue, model.deltas.totalEntregue),
      comparisonMetricSvg(712, 182, 'Pendências', model.statsA.totalPendente, model.statsB.totalPendente, model.deltas.totalPendente),
      comparisonMetricSvg(1032, 182, 'Insucesso', model.statsA.totalInsucesso, model.statsB.totalInsucesso, model.deltas.totalInsucesso),
      comparisonMetricSvg(72, 382, 'SLA', U.formatPercent(model.statsA.deliveryRate, 2), U.formatPercent(model.statsB.deliveryRate, 2), formatSigned(model.deltas.deliveryRate, function (v) { return U.formatPercent(v, 2); })),
      '<text x="72" y="620" font-size="30" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">Principais achados</text>',
      model.highlights.map(function (text, index) {
        return '<text x="72" y="' + (664 + index * 32) + '" font-size="22" font-family="Segoe UI, Arial" fill="#4a5a73">• ' + U.escapeHtml(text) + '</text>';
      }).join(''),
      '<text x="72" y="820" font-size="30" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">Bases alteradas: ' + U.escapeHtml(U.formatNumber(model.rows.length)) + '</text>',
      '</svg>'
    ].join('');
  }

  function comparisonMetricSvg(x, y, label, a, b, delta) {
    const deltaValue = typeof delta === 'number' ? formatSigned(delta, function (v) { return U.formatNumber(v); }) : String(delta || '');
    return [
      '<rect x="' + x + '" y="' + y + '" width="280" height="150" rx="20" fill="#f8fbff" stroke="#dce6f2"/>',
      '<text x="' + (x + 20) + '" y="' + (y + 34) + '" font-size="20" font-family="Segoe UI, Arial" font-weight="700" fill="#7a869b">' + U.escapeHtml(label) + '</text>',
      '<text x="' + (x + 20) + '" y="' + (y + 84) + '" font-size="34" font-family="Segoe UI, Arial" font-weight="700" fill="#24324b">' + U.escapeHtml(String(a)) + ' → ' + U.escapeHtml(String(b)) + '</text>',
      '<text x="' + (x + 20) + '" y="' + (y + 120) + '" font-size="22" font-family="Segoe UI, Arial" fill="#5b6b82">Δ ' + U.escapeHtml(deltaValue) + '</text>'
    ].join('');
  }

  function renderComparison(model) {
    state.comparisonModel = model;
    const result = byId('comparisonResult');
    const empty = byId('comparisonEmpty');
    if (!result || !model) return;

    empty.hidden = true;
    result.hidden = false;
    result.innerHTML = [
      '<section id="comparisonExport" class="comparison-shell">',
      '<div class="comparison-head">',
      '<div>',
      '<h2 class="viewer-title">' + U.escapeHtml(model.title) + '</h2>',
      '<div class="report-row-subtitle">' + U.escapeHtml(model.labelA) + ' <strong>vs</strong> ' + U.escapeHtml(model.labelB) + '</div>',
      '</div>',
      '<div class="viewer-top-actions">',
      '<span class="report-pill">Bases alteradas: ' + U.formatNumber(model.rows.length) + '</span>',
      '<span class="report-pill sla-pill-' + getSlaToneClass(model.statsB.deliveryRate) + '">SLA final: ' + U.formatPercent(model.statsB.deliveryRate || 0, 2) + '</span>',
      '</div>',
      '</div>',
      '<section class="comparison-side-grid">',
      '<article class="comparison-panel panel-a">',
      '<div class="comparison-panel__eyebrow">Período A</div>',
      '<h3>' + U.escapeHtml(model.labelA) + '</h3>',
      '<div class="comparison-panel__meta">Expedido ' + U.formatNumber(model.statsA.totalExpedido || 0) + ' • Entregues ' + U.formatNumber(model.statsA.totalEntregue || 0) + ' • SLA ' + U.formatPercent(model.statsA.deliveryRate || 0, 2) + '</div>',
      '</article>',
      '<article class="comparison-panel panel-b">',
      '<div class="comparison-panel__eyebrow">Período B</div>',
      '<h3>' + U.escapeHtml(model.labelB) + '</h3>',
      '<div class="comparison-panel__meta">Expedido ' + U.formatNumber(model.statsB.totalExpedido || 0) + ' • Entregues ' + U.formatNumber(model.statsB.totalEntregue || 0) + ' • SLA ' + U.formatPercent(model.statsB.deliveryRate || 0, 2) + '</div>',
      '</article>',
      '</section>',
      '<section class="summary-grid reports-summary-grid comparison-summary-grid">',
      deltaCardHtml('Expedido', U.formatNumber(model.statsA.totalExpedido || 0), U.formatNumber(model.statsB.totalExpedido || 0), model.deltas.totalExpedido, 'number', false),
      deltaCardHtml('Entregues', U.formatNumber(model.statsA.totalEntregue || 0), U.formatNumber(model.statsB.totalEntregue || 0), model.deltas.totalEntregue, 'number', false),
      deltaCardHtml('Pendências', U.formatNumber(model.statsA.totalPendente || 0), U.formatNumber(model.statsB.totalPendente || 0), model.deltas.totalPendente, 'number', true),
      deltaCardHtml('Insucesso', U.formatNumber(model.statsA.totalInsucesso || 0), U.formatNumber(model.statsB.totalInsucesso || 0), model.deltas.totalInsucesso, 'number', true),
      deltaCardHtml('SLA', U.formatPercent(model.statsA.deliveryRate || 0, 2), U.formatPercent(model.statsB.deliveryRate || 0, 2), model.deltas.deliveryRate, 'percent', false),
      '</section>',
      '<section class="comparison-insights-grid">',
      model.highlights.map(function (text) {
        return '<article class="comparison-insight"><small>Insight automático</small><strong>' + U.escapeHtml(text) + '</strong><span>Conciliação inteligente focada no que mudou entre os períodos.</span></article>';
      }).join(''),
      '</section>',
      '<article class="card report-inner-card"><div class="section-header"><h3>Diferenças por base</h3><span class="text-soft">Side-by-side estrito com foco no que mudou</span></div>' + diffTableHtml(model.rows) + '</article>',
      '</section>'
    ].join('');
  }

  async function compareSelected() {
    if (state.selectedIds.length !== 2) {
      U.showMessage('reportsMessage', 'Selecione exatamente 2 snapshots para comparar.', 'warning');
      return;
    }
    const snapshots = await Promise.all(state.selectedIds.map(function (id) { return Store.getSnapshotById(id); }));
    if (snapshots.some(function (item) { return !item; })) {
      U.showMessage('reportsMessage', 'Falha ao carregar um dos snapshots selecionados.', 'error');
      return;
    }
    const ordered = snapshots.slice().sort(function (a, b) { return String(a.savedAt).localeCompare(String(b.savedAt)); });
    renderComparison(buildComparisonModel(
      'Comparação entre snapshots selecionados',
      U.formatDateTimeBR(ordered[0].savedAt),
      U.formatDateTimeBR(ordered[1].savedAt),
      ordered[0],
      ordered[1],
      { mode: 'snapshots' }
    ));
  }

  function compareWindows() {
    const aStart = parseDateTimeInput('compareAStart');
    const aEnd = parseDateTimeInput('compareAEnd');
    const bStart = parseDateTimeInput('compareBStart');
    const bEnd = parseDateTimeInput('compareBEnd');

    if (!aStart || !aEnd || !bStart || !bEnd) {
      U.showMessage('reportsMessage', 'Preencha início e fim dos dois períodos.', 'warning');
      return;
    }

    const snapshotsA = getWindowSnapshots(aStart, aEnd);
    const snapshotsB = getWindowSnapshots(bStart, bEnd);

    if (!snapshotsA.length || !snapshotsB.length) {
      U.showMessage('reportsMessage', 'Não existem snapshots suficientes dentro das janelas escolhidas.', 'warning');
      return;
    }

    const periodA = buildPeriodModel('Período A', snapshotsA);
    const periodB = buildPeriodModel('Período B', snapshotsB);

    renderComparison(buildComparisonModel(
      'Comparação por janelas de tempo',
      U.formatDateTimeBR(aStart) + ' até ' + U.formatDateTimeBR(aEnd),
      U.formatDateTimeBR(bStart) + ' até ' + U.formatDateTimeBR(bEnd),
      periodA.representative,
      periodB.representative,
      { mode: 'windows', periodA: periodA, periodB: periodB }
    ));
  }

  async function copyElementAsImage(selector, filenameBase) {
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!element || !window.html2canvas) {
      U.showMessage('reportsMessage', 'Não foi possível gerar a imagem deste bloco.', 'warning');
      return;
    }

    const canvas = await window.html2canvas(element, {
      backgroundColor: '#f3f6fb',
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false
    });

    return new Promise(function (resolve, reject) {
      canvas.toBlob(async function (blob) {
        if (!blob) {
          reject(new Error('Falha ao gerar imagem.'));
          return;
        }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          U.showMessage('reportsMessage', 'Imagem copiada para a área de transferência.', 'success');
          resolve(true);
        } catch (error) {
          reject(error);
        }
      }, 'image/png');
    }).catch(function () {
      U.showMessage('reportsMessage', 'Não foi possível copiar a imagem neste navegador.', 'warning');
    });
  }

  async function downloadElementAsPng(selector, filename) {
    const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!element || !window.html2canvas) {
      U.showMessage('reportsMessage', 'Não foi possível baixar este bloco como PNG.', 'warning');
      return;
    }
    const canvas = await window.html2canvas(element, {
      backgroundColor: '#f3f6fb',
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false
    });
    const url = canvas.toDataURL('image/png');
    U.downloadBlobURL(url, filename);
  }

  function downloadSvgString(svgString, filename) {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    U.downloadBlobURL(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  async function exportPlotlyImage(format, filename) {
    const chart = byId('historyChart');
    if (!PlotlyLib || !chart || !chart.data || !chart.data.length) {
      U.showMessage('reportsMessage', 'Não existe gráfico pronto para exportar.', 'warning');
      return;
    }
    const url = await PlotlyLib.toImage(chart, {
      format: format,
      width: 1600,
      height: 620,
      scale: 2
    });
    U.downloadBlobURL(url, filename);
  }

  async function copyPlotlyImage() {
    const chart = byId('historyChart');
    if (!PlotlyLib || !chart || !chart.data || !chart.data.length) {
      U.showMessage('reportsMessage', 'Não existe gráfico pronto para copiar.', 'warning');
      return;
    }
    const url = await PlotlyLib.toImage(chart, {
      format: 'png',
      width: 1600,
      height: 620,
      scale: 2
    });
    const blob = await fetch(url).then(function (resp) { return resp.blob(); });
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      U.showMessage('reportsMessage', 'Gráfico copiado como imagem.', 'success');
    } catch (error) {
      U.showMessage('reportsMessage', 'Não foi possível copiar o gráfico neste navegador.', 'warning');
    }
  }

  function renderHistoryChart(items) {
    const chart = byId('historyChart');
    if (!chart || !PlotlyLib) return;

    const baseFilter = getFilters().base;
    const series = items.slice().reverse();

    if (!series.length) {
      chart.innerHTML = '<div class="report-viewer-empty">Sem snapshots para montar o gráfico histórico.</div>';
      return;
    }

    const x = series.map(function (item) { return item.savedAt; });
    const stats = series.map(function (item) { return getSnapshotStats(item, baseFilter); });

    const data = [
      {
        type: 'bar',
        name: 'Entregues',
        x: x,
        y: stats.map(function (s) { return s.totalEntregue; }),
        marker: { color: '#2563eb', opacity: 0.9 },
        hovertemplate: '%{x}<br>Entregues: %{y:,}<extra></extra>'
      },
      {
        type: 'bar',
        name: 'Insucesso',
        x: x,
        y: stats.map(function (s) { return s.totalInsucesso; }),
        marker: { color: '#ef4444', opacity: 0.86 },
        hovertemplate: '%{x}<br>Insucesso: %{y:,}<extra></extra>'
      },
      {
        type: 'bar',
        name: 'Pendências',
        x: x,
        y: stats.map(function (s) { return s.totalPendente; }),
        marker: { color: '#f59e0b', opacity: 0.84 },
        hovertemplate: '%{x}<br>Pendências: %{y:,}<extra></extra>'
      },
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'SLA',
        x: x,
        y: stats.map(function (s) { return s.deliveryRate; }),
        yaxis: 'y2',
        line: { color: '#16a34a', width: 3 },
        marker: { size: 7, color: '#166534' },
        hovertemplate: '%{x}<br>SLA: %{y:.2f}%<extra></extra>'
      }
    ];

    const layout = {
      barmode: 'stack',
      margin: { t: 18, r: 54, b: 54, l: 56 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(248,250,252,0.86)',
      legend: { orientation: 'h', y: 1.16, x: 0, font: { size: 12 } },
      hovermode: 'x unified',
      xaxis: {
        type: 'date',
        showgrid: true,
        gridcolor: 'rgba(203,213,225,0.45)',
        tickfont: { size: 11 }
      },
      yaxis: {
        title: 'Volume',
        showgrid: true,
        gridcolor: 'rgba(203,213,225,0.45)',
        zerolinecolor: 'rgba(148,163,184,0.5)'
      },
      yaxis2: {
        title: 'SLA %',
        overlaying: 'y',
        side: 'right',
        range: [0, 100],
        tickformat: '.0f'
      }
    };

    PlotlyLib.newPlot(chart, data, layout, {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']
    });
  }

  async function loadReports() {
    state.allItems = await Store.listSnapshots({});
    populateBaseFilter(state.allItems);
    await applyFilters();
  }

  async function applyFilters() {
    const filters = getFilters();
    state.items = await Store.listSnapshots(filters);
    updateHeaderBadges(state.items);
    renderStats(state.items);
    renderList(state.items);
    renderHistoryChart(state.items);
    if (state.openedId && !state.items.some(function (item) { return item.id === state.openedId; })) {
      state.openedId = null;
      byId('reportViewer').className = 'report-viewer-empty';
      byId('reportViewer').innerHTML = 'Selecione um relatório para visualizar os números gerais, as bases, os motoristas e os sinais de operação.';
    }
  }

  async function clearFilters() {
    ['startDateTime', 'endDateTime', 'reportSearch'].forEach(function (id) {
      if (byId(id)) byId(id).value = '';
    });
    if (byId('reportBaseFilter')) byId('reportBaseFilter').value = 'all';
    await applyFilters();
  }

  async function deleteSnapshot(id) {
    await Store.deleteSnapshot(id);
    state.selectedIds = state.selectedIds.filter(function (value) { return value !== id; });
    if (state.openedId === id) state.openedId = null;
    await loadReports();
    U.showMessage('reportsMessage', 'Snapshot removido com sucesso.', 'success');
  }

  async function clearAllSnapshots() {
    if (!window.confirm('Deseja apagar todo o histórico local de snapshots?')) return;
    await Store.clearAllSnapshots();
    state.selectedIds = [];
    state.openedId = null;
    state.comparisonModel = null;
    byId('comparisonResult').hidden = true;
    byId('comparisonEmpty').hidden = false;
    byId('reportViewer').className = 'report-viewer-empty';
    byId('reportViewer').innerHTML = 'Selecione um relatório para visualizar os números gerais, as bases, os motoristas e os sinais de operação.';
    await loadReports();
    U.showMessage('reportsMessage', 'Histórico local apagado.', 'success');
  }

  function bindEvents() {
    byId('applyReportFilters').addEventListener('click', applyFilters);
    byId('clearReportFilters').addEventListener('click', clearFilters);
    byId('compareSelectedBtn').addEventListener('click', compareSelected);
    byId('compareWindowsBtn').addEventListener('click', compareWindows);
    byId('clearReportsBtn').addEventListener('click', clearAllSnapshots);
    byId('compareChangedOnly').addEventListener('change', function () {
      if (!state.comparisonModel) return;
      if (state.comparisonModel.meta && state.comparisonModel.meta.mode === 'snapshots') compareSelected(); else compareWindows();
    });

    byId('reportsList').addEventListener('click', function (event) {
      const openBtn = event.target.closest('.report-open-btn');
      const deleteBtn = event.target.closest('.report-delete-btn');
      const row = event.target.closest('.report-row');
      if (openBtn) {
        openSnapshot(openBtn.getAttribute('data-report-id'));
        return;
      }
      if (deleteBtn) {
        deleteSnapshot(deleteBtn.getAttribute('data-report-id'));
        return;
      }
      if (row && !event.target.closest('button') && !event.target.closest('input')) {
        openSnapshot(row.getAttribute('data-report-id'));
      }
    });

    byId('reportsList').addEventListener('change', function (event) {
      const checkbox = event.target.closest('.report-select');
      if (!checkbox) return;
      const id = checkbox.getAttribute('data-report-id');
      if (checkbox.checked) {
        if (!state.selectedIds.includes(id)) state.selectedIds.push(id);
        if (state.selectedIds.length > 2) {
          const removed = state.selectedIds.shift();
          const oldInput = document.querySelector('.report-select[data-report-id="' + removed + '"]');
          if (oldInput) oldInput.checked = false;
        }
      } else {
        state.selectedIds = state.selectedIds.filter(function (value) { return value !== id; });
      }
    });

    byId('copyOpenReportBtn').addEventListener('click', function () {
      copyElementAsImage('#reportViewerExport', 'relatorio_snapshot');
    });
    byId('downloadOpenReportBtn').addEventListener('click', function () {
      downloadElementAsPng('#reportViewerExport', 'relatorio_snapshot.png');
    });
    byId('downloadOpenReportSvgBtn').addEventListener('click', async function () {
      if (!state.openedId) {
        U.showMessage('reportsMessage', 'Abra um relatório antes de exportar em SVG.', 'warning');
        return;
      }
      const snapshot = await Store.getSnapshotById(state.openedId);
      if (!snapshot) return;
      downloadSvgString(buildReportSvg(snapshot), 'relatorio_snapshot.svg');
    });

    byId('copyComparisonBtn').addEventListener('click', function () {
      copyElementAsImage('#comparisonExport', 'comparacao_snapshot');
    });
    byId('downloadComparisonBtn').addEventListener('click', function () {
      downloadElementAsPng('#comparisonExport', 'comparacao_snapshot.png');
    });
    byId('downloadComparisonSvgBtn').addEventListener('click', function () {
      if (!state.comparisonModel) {
        U.showMessage('reportsMessage', 'Gere uma comparação antes de exportar em SVG.', 'warning');
        return;
      }
      downloadSvgString(buildComparisonSvg(state.comparisonModel), 'comparacao_snapshot.svg');
    });

    byId('copyChartBtn').addEventListener('click', copyPlotlyImage);
    byId('downloadChartPngBtn').addEventListener('click', function () { exportPlotlyImage('png', 'historico_operacional.png'); });
    byId('downloadChartSvgBtn').addEventListener('click', function () { exportPlotlyImage('svg', 'historico_operacional.svg'); });

    ['startDateTime', 'endDateTime', 'reportSearch', 'reportBaseFilter'].forEach(function (id) {
      const el = byId(id);
      if (!el) return;
      const handler = id === 'reportSearch' ? U.debounce(applyFilters, 280) : applyFilters;
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function seedCompareInputs() {
    const latest = state.allItems[0];
    const previous = state.allItems[1];
    if (!latest) return;
    const latestDate = new Date(latest.savedAt);
    const prevDate = previous ? new Date(previous.savedAt) : new Date(latestDate.getTime() - 60 * 60 * 1000);

    byId('compareBStart').value = formatInputDate(new Date(latestDate.getTime() - 30 * 60 * 1000));
    byId('compareBEnd').value = formatInputDate(latestDate);
    byId('compareAStart').value = formatInputDate(new Date(prevDate.getTime() - 30 * 60 * 1000));
    byId('compareAEnd').value = formatInputDate(prevDate);
  }

  async function init() {
    if (!Store) return;
    bindEvents();
    await loadReports();
    seedCompareInputs();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
