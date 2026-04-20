(function () {
  "use strict";

const AG_STORAGE_KEY = "acompanhamentoGeralState.v1";

const AG_REGIONAIS = {
  claudio: [
    "S-CRDR-SP","GRU-SP","S-CSVD-SP","S-BRFD-SP","S-FREG-SP","F GRU-SP",
    "S-BRAS-SP","F S-JRG-SP","F S-VLMR-SP","GRU 03-SP","S-VLGUI-SP",
    "F S-BRSL-SP","F S-BLV-SP"
  ],
  rodrigo: [
    "S-SAPOP-SP","S-PENHA-SP","S-MGUE-SP","MGC-SP","ARJ-SP","SDR-SP",
    "S-SRAF-SP","F ITQ-SP","F S-PENHA-SP","F S-PENHA 02-SP","F S-MGUE-SP"
  ],
  neto: [
    "CARAP-SP","CHM-SP","COT-SP","JDR-SP","OSC-SP","S-VLANA-SP",
    "S-VLLEO-SP","S-VLSN-SP","TBA-SP","VRG-SP"
  ],
  luana: [
    "AME-SP","FRCLR-SP","F VCP-SP","MGG-SP","PIR-SP","RCLR-SP","SMR-SP",
    "VCP 03-SP","VCP 05-SP","VIN-SP","FJND-SP","ITUP-SP","JND-SP","BRG-SP",
    "CAIE-SP","ATB-SP","F SOD 02-SP","IBUN-SP","ITPT-SP","ITPV-SP","ITU-SP",
    "SOD02-SP","SOD-SP","SRQ-SP","INDTR SD"
  ]
};

const agState = {
  rows: [],
  workbookName: "",
  selectedBase: "all",
  statusChart: null,
  basesChart: null
};

const agElements = {
  fileInput: document.getElementById("agFileInput"),
  importBtn: document.getElementById("agImportBtn"),
  clearBtn: document.getElementById("agClearBtn"),
  baseFilter: document.getElementById("agBaseFilter"),
  fileName: document.getElementById("agFileName"),
  appMessage: document.getElementById("agMessage"),
  totalExpedido: document.getElementById("agTotalExpedido"),
  assinados: document.getElementById("agAssinados"),
  taxa: document.getElementById("agTaxa"),
  taxaCard: document.getElementById("agTaxaCard"),
  naoEntregue: document.getElementById("agNaoEntregue"),
  naoExpedido: document.getElementById("agNaoExpedido"),
  problematico: document.getElementById("agProblematico"),
  topBases: document.getElementById("agTopBases"),
  worstBases: document.getElementById("agWorstBases"),
  regionalClaudio: document.getElementById("agRegionalClaudio"),
  regionalRodrigo: document.getElementById("agRegionalRodrigo"),
  regionalNeto: document.getElementById("agRegionalNeto"),
  regionalLuana: document.getElementById("agRegionalLuana")
};

const AG_COLUMN_ALIASES = {
  base: [
    "Base de entrega",
    "Base",
    "base de entrega"
  ],
  totalExpedido: [
    "número total de expedido",
    "numero total de expedido",
    "Número total de expedido",
    "Total expedido",
    "Expedido"
  ],
  assinados: [
    "Número de pacotes assinados",
    "Numero de pacotes assinados",
    "Pacotes assinados",
    "Número de entregues",
    "Numero de entregues",
    "Entregues",
    "Pacotes entregues",
    "Número de pacotes entregues",
    "Numero de pacotes entregues"
  ],
  naoEntregue: [
    "Não entregue",
    "Nao entregue",
    "Não entregues",
    "Nao entregues"
  ],
  naoExpedido: [
    "pacote não expedido",
    "pacote nao expedido",
    "Pacote não expedido",
    "Pacote nao expedido",
    "Não expedido",
    "Nao expedido",
    "Não expedidos",
    "Nao expedidos"
  ],
  problematico: [
    "Pacote problemático",
    "Pacote problematico",
    "Problemático",
    "Problematico"
  ]
};

function agNormalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function agNormalizeBase(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();
}

function agFormatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function agFindColumnName(row, aliases) {
  const keys = Object.keys(row || {});
  const normalizedMap = new Map(keys.map((key) => [agNormalizeText(key), key]));
  for (const alias of aliases) {
    const found = normalizedMap.get(agNormalizeText(alias));
    if (found) return found;
  }
  return "";
}

function agToNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "")
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function agShowMessage(text, type = "neutral") {
  agElements.appMessage.className = `message-box is-${type}`;
  agElements.appMessage.textContent = text;
}

function agBuildNormalizedRows(rawRows) {
  if (!Array.isArray(rawRows) || !rawRows.length) {
    throw new Error("A planilha veio vazia ou sem linhas válidas.");
  }

  const sample = rawRows.find((row) => row && Object.keys(row).length) || rawRows[0];

  const columns = {
    base: agFindColumnName(sample, AG_COLUMN_ALIASES.base),
    totalExpedido: agFindColumnName(sample, AG_COLUMN_ALIASES.totalExpedido),
    assinados: agFindColumnName(sample, AG_COLUMN_ALIASES.assinados),
    naoEntregue: agFindColumnName(sample, AG_COLUMN_ALIASES.naoEntregue),
    naoExpedido: agFindColumnName(sample, AG_COLUMN_ALIASES.naoExpedido),
    problematico: agFindColumnName(sample, AG_COLUMN_ALIASES.problematico)
  };

  const missing = Object.entries(columns)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Não encontrei todas as colunas esperadas. Faltando: ${missing.join(", ")}.`);
  }

  return rawRows
    .map((row) => ({
      base: String(row[columns.base] || "").trim(),
      totalExpedido: agToNumber(row[columns.totalExpedido]),
      assinados: agToNumber(row[columns.assinados]),
      naoEntregue: agToNumber(row[columns.naoEntregue]),
      naoExpedido: agToNumber(row[columns.naoExpedido]),
      problematico: agToNumber(row[columns.problematico])
    }))
    .filter((row) => row.base);
}

function agSaveState() {
  localStorage.setItem(AG_STORAGE_KEY, JSON.stringify({
    rows: agState.rows,
    workbookName: agState.workbookName,
    selectedBase: agState.selectedBase
  }));
}

function agRestoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(AG_STORAGE_KEY) || "null");
    if (!saved || !Array.isArray(saved.rows) || !saved.rows.length) return;
    agState.rows = saved.rows;
    agState.workbookName = saved.workbookName || "";
    agState.selectedBase = saved.selectedBase || "all";
    agElements.fileName.textContent = agState.workbookName || "Arquivo restaurado do navegador";
    agFillBaseFilter();
    agElements.baseFilter.value = agState.selectedBase;
    agRender();
    agShowMessage("Dados restaurados do navegador.", "success");
  } catch {
    localStorage.removeItem(AG_STORAGE_KEY);
  }
}

function agFillBaseFilter() {
  const bases = [...new Set(agState.rows.map((row) => row.base))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  agElements.baseFilter.innerHTML = '<option value="all">Todas as bases</option>';
  for (const base of bases) {
    const option = document.createElement("option");
    option.value = base;
    option.textContent = base;
    agElements.baseFilter.appendChild(option);
  }
}

function agGetFilteredRows() {
  return agState.selectedBase === "all"
    ? agState.rows
    : agState.rows.filter((row) => row.base === agState.selectedBase);
}

function agDestroyCharts() {
  if (agState.statusChart) {
    agState.statusChart.destroy();
    agState.statusChart = null;
  }
  if (agState.basesChart) {
    agState.basesChart.destroy();
    agState.basesChart = null;
  }
}

function agRenderStatusChart(totals) {
  const canvas = document.getElementById("agStatusChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (agState.statusChart) agState.statusChart.destroy();

  agState.statusChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Assinados", "Não entregue", "Não expedido", "Problemático"],
      datasets: [{
        data: [totals.assinados, totals.naoEntregue, totals.naoExpedido, totals.problematico],
        backgroundColor: ["#16a34a", "#ef4444", "#f59e0b", "#b91c1c"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

function agRenderBasesChart(rows) {
  const canvas = document.getElementById("agBasesChart");
  if (!canvas || typeof Chart === "undefined") return;
  if (agState.basesChart) agState.basesChart.destroy();

  const ranked = rows
    .map((row) => ({
      base: row.base,
      taxa: row.totalExpedido ? (row.assinados / row.totalExpedido) * 100 : 0
    }))
    .sort((a, b) => b.taxa - a.taxa)
    .slice(0, 15);

  agState.basesChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ranked.map((item) => item.base),
      datasets: [{
        label: "SLA",
        data: ranked.map((item) => Number(item.taxa.toFixed(2))),
        backgroundColor: "#d81f26",
        borderRadius: 10,
        maxBarThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax: 100
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function agRenderRankingTable(target, rows, emptyText = "Sem dados") {
  if (!rows.length) {
    target.innerHTML = `<tr><td colspan="2" class="text-soft">${emptyText}</td></tr>`;
    return;
  }

  target.innerHTML = rows.map((item) => `
    <tr>
      <td>${item.base}</td>
      <td class="t-right"><strong>${item.taxa.toFixed(2)}%</strong></td>
    </tr>
  `).join("");
}

function agRenderRegionalTable(target, baseList) {
  const normalizedBases = new Set(baseList.map(agNormalizeBase));
  const rows = agState.rows
    .filter((row) => normalizedBases.has(agNormalizeBase(row.base)))
    .map((row) => ({
      ...row,
      taxa: row.totalExpedido ? (row.assinados / row.totalExpedido) * 100 : 0
    }))
    .sort((a, b) => b.taxa - a.taxa);

  if (!rows.length) {
    target.innerHTML = '<tr><td colspan="6" class="text-soft">Sem dados para esta regional</td></tr>';
    return;
  }

  target.innerHTML = rows.map((row) => {
    const badgeClass = row.taxa >= 90 ? "ag-badge-success" : row.taxa >= 80 ? "ag-badge-warning" : "ag-badge-danger";
    return `
      <tr>
        <td>${row.base}</td>
        <td class="t-right">${agFormatNumber(row.totalExpedido)}</td>
        <td class="t-right">${agFormatNumber(row.assinados)}</td>
        <td class="t-right">${agFormatNumber(row.naoExpedido)}</td>
        <td class="t-right">${agFormatNumber(row.problematico)}</td>
        <td class="t-right"><span class="ag-badge ${badgeClass}">${row.taxa.toFixed(2)}%</span></td>
      </tr>
    `;
  }).join("");
}

function agRender() {
  const rows = agGetFilteredRows();

  const totals = rows.reduce((acc, row) => {
    acc.totalExpedido += row.totalExpedido;
    acc.assinados += row.assinados;
    acc.naoEntregue += row.naoEntregue;
    acc.naoExpedido += row.naoExpedido;
    acc.problematico += row.problematico;
    return acc;
  }, {
    totalExpedido: 0,
    assinados: 0,
    naoEntregue: 0,
    naoExpedido: 0,
    problematico: 0
  });

  const taxa = totals.totalExpedido ? (totals.assinados / totals.totalExpedido) * 100 : 0;

  agElements.totalExpedido.textContent = agFormatNumber(totals.totalExpedido);
  agElements.assinados.textContent = agFormatNumber(totals.assinados);
  agElements.naoEntregue.textContent = agFormatNumber(totals.naoEntregue);
  agElements.naoExpedido.textContent = agFormatNumber(totals.naoExpedido);
  agElements.problematico.textContent = agFormatNumber(totals.problematico);
  agElements.taxa.textContent = `${taxa.toFixed(2)}%`;

  agElements.taxaCard.classList.remove("ag-rate-danger", "ag-rate-warning", "ag-rate-success");
  if (taxa >= 90) agElements.taxaCard.classList.add("ag-rate-success");
  else if (taxa >= 80) agElements.taxaCard.classList.add("ag-rate-warning");
  else agElements.taxaCard.classList.add("ag-rate-danger");

  agRenderStatusChart(totals);

  if (agState.selectedBase === "all") {
    agRenderBasesChart(agState.rows);

    const ranking = agState.rows
      .map((row) => ({
        base: row.base,
        taxa: row.totalExpedido ? (row.assinados / row.totalExpedido) * 100 : 0
      }))
      .sort((a, b) => b.taxa - a.taxa);

    agRenderRankingTable(agElements.topBases, ranking.slice(0, 10));
    agRenderRankingTable(agElements.worstBases, [...ranking].reverse().slice(0, 10));
    agRenderRegionalTable(agElements.regionalClaudio, AG_REGIONAIS.claudio);
    agRenderRegionalTable(agElements.regionalRodrigo, AG_REGIONAIS.rodrigo);
    agRenderRegionalTable(agElements.regionalNeto, AG_REGIONAIS.neto);
    agRenderRegionalTable(agElements.regionalLuana, AG_REGIONAIS.luana);
  } else {
    agRenderBasesChart(rows);
    agRenderRankingTable(agElements.topBases, [] , "Selecione 'Todas as bases' para ver o ranking");
    agRenderRankingTable(agElements.worstBases, [] , "Selecione 'Todas as bases' para ver o ranking");
    agElements.regionalClaudio.innerHTML = '<tr><td colspan="6" class="text-soft">Disponível somente em Todas as bases</td></tr>';
    agElements.regionalRodrigo.innerHTML = '<tr><td colspan="6" class="text-soft">Disponível somente em Todas as bases</td></tr>';
    agElements.regionalNeto.innerHTML = '<tr><td colspan="6" class="text-soft">Disponível somente em Todas as bases</td></tr>';
    agElements.regionalLuana.innerHTML = '<tr><td colspan="6" class="text-soft">Disponível somente em Todas as bases</td></tr>';
  }

  agSaveState();
}

async function agHandleFile(file) {
  if (!file) return;
  try {
    agShowMessage("Lendo arquivo...", "neutral");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    agState.rows = agBuildNormalizedRows(rawRows);
    agState.workbookName = file.name;
    agState.selectedBase = "all";

    agElements.fileName.textContent = file.name;
    agFillBaseFilter();
    agElements.baseFilter.value = "all";
    agRender();
    agShowMessage(`Arquivo importado com sucesso: ${file.name}`, "success");
  } catch (error) {
    console.error(error);
    agShowMessage(error.message || "Falha ao processar o arquivo.", "danger");
  }
}

function agClearData() {
  agState.rows = [];
  agState.workbookName = "";
  agState.selectedBase = "all";
  agDestroyCharts();
  localStorage.removeItem(AG_STORAGE_KEY);
  agElements.fileInput.value = "";
  agElements.fileName.textContent = "Nenhum arquivo importado";
  agElements.baseFilter.innerHTML = '<option value="all">Todas as bases</option>';
  agElements.totalExpedido.textContent = "0";
  agElements.assinados.textContent = "0";
  agElements.taxa.textContent = "0%";
  agElements.naoEntregue.textContent = "0";
  agElements.naoExpedido.textContent = "0";
  agElements.problematico.textContent = "0";
  agElements.topBases.innerHTML = '<tr><td colspan="2" class="text-soft">Sem dados</td></tr>';
  agElements.worstBases.innerHTML = '<tr><td colspan="2" class="text-soft">Sem dados</td></tr>';
  agElements.regionalClaudio.innerHTML = '<tr><td colspan="6" class="text-soft">Sem dados</td></tr>';
  agElements.regionalRodrigo.innerHTML = '<tr><td colspan="6" class="text-soft">Sem dados</td></tr>';
  agElements.regionalNeto.innerHTML = '<tr><td colspan="6" class="text-soft">Sem dados</td></tr>';
  agElements.regionalLuana.innerHTML = '<tr><td colspan="6" class="text-soft">Sem dados</td></tr>';
  agShowMessage("Dados locais removidos desta página.", "neutral");
}

function agBindEvents() {
  agElements.importBtn.addEventListener("click", () => agElements.fileInput.click());
  agElements.fileInput.addEventListener("change", (event) => agHandleFile(event.target.files?.[0]));
  agElements.clearBtn.addEventListener("click", agClearData);
  agElements.baseFilter.addEventListener("change", (event) => {
    agState.selectedBase = event.target.value;
    agRender();
  });
}

function agBoot() {
  agBindEvents();
  agRestoreState();
  if (!agState.rows.length) {
    agShowMessage("Importe o arquivo de acompanhamento geral para montar o painel.", "neutral");
  }
}

agBoot();


})();
