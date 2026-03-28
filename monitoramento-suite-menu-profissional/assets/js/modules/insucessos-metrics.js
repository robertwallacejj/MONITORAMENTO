(function () {
  "use strict";

  const U = window.CTUtils;

  const COLUMN_GROUPS = {
    base: ["Base de entrega", "Base", "base"],
    driver: ["Entregador", "Motorista", "Courier", "Driver", "driver"],
    date: [
      "Data",
      "Data de baixa",
      "Data da baixa",
      "Data entrega",
      "Data de entrega",
      "Data do relatório",
      "Data do relatorio",
      "Dia",
      "date"
    ],
    reason: [
      "Motivos dos pacotes problemáticos",
      "Motivos dos pacotes problematicos",
      "Pacote problemático",
      "Pacote problematico",
      "Motivo",
      "Motivo do insucesso",
      "Insucesso",
      "problemReason",
      "M",
      "Coluna M",
      "Status M",
      "Motivo M",
      "Ocorrência M",
      "Ocorrencia M",
      "H",
      "Coluna H",
      "Status H",
      "Motivo H",
      "Ocorrência H",
      "Ocorrencia H",
      "I",
      "Coluna I",
      "Status I",
      "Motivo I",
      "Ocorrência I",
      "Ocorrencia I"
    ]
  };

  const STORAGE_DATE_REGEX = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;

  function getField(row, aliases) {
    if (!row || typeof row !== "object") return "";

    const keys = Array.isArray(aliases) ? aliases : [aliases];

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        return row[key];
      }
    }

    const normalizedAliases = keys.map(function (item) {
      return U.normalizar(String(item || ""));
    });

    const rowKeys = Object.keys(row);
    for (let i = 0; i < rowKeys.length; i += 1) {
      const key = rowKeys[i];
      if (normalizedAliases.includes(U.normalizar(key))) {
        return row[key];
      }
    }

    return "";
  }

  function isFilled(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return !Number.isNaN(value);
    return String(value).trim() !== "";
  }

  function cleanReason(value) {
    if (!isFilled(value)) return "";

    let text = String(value).trim();

    const hyphenIndex = text.indexOf("-");
    if (hyphenIndex >= 0) {
      text = text.slice(hyphenIndex + 1);
    }

    text = text
      .replace(/[._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text;
  }

  function normalizeReasonKey(value) {
    return U.normalizar(cleanReason(value));
  }

  function parseExcelDate(value) {
    if (!isFilled(value)) return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const dd = String(value.getDate()).padStart(2, "0");
      const mm = String(value.getMonth() + 1).padStart(2, "0");
      const yyyy = String(value.getFullYear());
      return dd + "/" + mm + "/" + yyyy;
    }

    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const dd = String(parsed.d).padStart(2, "0");
        const mm = String(parsed.m).padStart(2, "0");
        const yyyy = String(parsed.y);
        return dd + "/" + mm + "/" + yyyy;
      }
    }

    const text = String(value).trim();
    const match = text.match(STORAGE_DATE_REGEX);

    if (match) {
      const day = String(match[1]).padStart(2, "0");
      const month = String(match[2]).padStart(2, "0");
      let year = match[3] || String(new Date().getFullYear());

      if (year.length === 2) {
        year = "20" + year;
      }

      return day + "/" + month + "/" + year;
    }

    const asDate = new Date(text);
    if (!Number.isNaN(asDate.getTime())) {
      const dd = String(asDate.getDate()).padStart(2, "0");
      const mm = String(asDate.getMonth() + 1).padStart(2, "0");
      const yyyy = String(asDate.getFullYear());
      return dd + "/" + mm + "/" + yyyy;
    }

    return "";
  }

  function getDateFromFileName(fileName) {
    const match = String(fileName || "").match(STORAGE_DATE_REGEX);
    if (!match) return "";

    const day = String(match[1]).padStart(2, "0");
    const month = String(match[2]).padStart(2, "0");
    let year = match[3] || String(new Date().getFullYear());

    if (year.length === 2) {
      year = "20" + year;
    }

    return day + "/" + month + "/" + year;
  }

  function getRowDate(row, fileName) {
    const direct = parseExcelDate(getField(row, COLUMN_GROUPS.date));
    if (direct) return direct;
    return getDateFromFileName(fileName);
  }

  function extractReason(row) {
    const direct = getField(row, [
      "Motivos dos pacotes problemáticos",
      "Motivos dos pacotes problematicos",
      "Pacote problemático",
      "Pacote problematico",
      "Motivo",
      "Motivo do insucesso",
      "Insucesso",
      "problemReason"
    ]);

    if (isFilled(direct)) return cleanReason(direct);

    const m = getField(row, ["M", "Coluna M", "Status M", "Motivo M", "Ocorrência M", "Ocorrencia M"]);
    if (isFilled(m)) return cleanReason(m);

    const h = getField(row, ["H", "Coluna H", "Status H", "Motivo H", "Ocorrência H", "Ocorrencia H"]);
    if (isFilled(h)) return cleanReason(h);

    const i = getField(row, ["I", "Coluna I", "Status I", "Motivo I", "Ocorrência I", "Ocorrencia I"]);
    if (isFilled(i)) return cleanReason(i);

    return "";
  }

  function isInsucessoRow(row) {
    const reason = extractReason(row);
    if (!reason) return false;

    const deliveredTime = getField(row, [
      "Horário da entrega",
      "Horario da entrega",
      "J",
      "Coluna J",
      "Data Baixa",
      "Baixa",
      "Entrega",
      "Data Entrega"
    ]);

    if (isFilled(deliveredTime)) return false;

    return true;
  }

  function normalizeRow(row, fileName) {
    const base = String(getField(row, COLUMN_GROUPS.base) || "BASE INDEFINIDA").trim();
    const driver = String(getField(row, COLUMN_GROUPS.driver) || "NÃO ATRIBUÍDO").trim();
    const reason = extractReason(row);
    const date = getRowDate(row, fileName);

    return {
      base: base || "BASE INDEFINIDA",
      driver: driver || "NÃO ATRIBUÍDO",
      reason: reason || "Motivo não informado",
      reasonKey: normalizeReasonKey(reason || "Motivo não informado"),
      date: date || "Sem data",
      fileName: fileName || "",
      raw: row
    };
  }

  function inspectWorkbook(file, arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const collectedRows = [];

    workbook.SheetNames.forEach(function (sheetName) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      rows.forEach(function (row) {
        if (isInsucessoRow(row)) {
          collectedRows.push(normalizeRow(row, file.name));
        }
      });
    });

    return collectedRows;
  }

  async function inspectFiles(fileList) {
    const files = Array.from(fileList || []);
    const allRows = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const rows = inspectWorkbook(file, buffer);
      allRows.push.apply(allRows, rows);
    }

    return allRows;
  }

  function groupCount(rows, field) {
    const grouped = {};

    rows.forEach(function (item) {
      const key = item[field] || "Não informado";
      if (!grouped[key]) {
        grouped[key] = { label: key, total: 0 };
      }
      grouped[key].total += 1;
    });

    return Object.values(grouped).sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return a.label.localeCompare(b.label, "pt-BR");
    });
  }

  function groupDrivers(rows) {
    const grouped = {};

    rows.forEach(function (item) {
      const driver = item.driver || "NÃO ATRIBUÍDO";
      const base = item.base || "BASE INDEFINIDA";
      const key = base + "__" + driver;

      if (!grouped[key]) {
        grouped[key] = {
          driver: driver,
          base: base,
          total: 0
        };
      }

      grouped[key].total += 1;
    });

    return Object.values(grouped).sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      if (a.base !== b.base) return a.base.localeCompare(b.base, "pt-BR");
      return a.driver.localeCompare(b.driver, "pt-BR");
    });
  }

  function filterRows(rows, filters) {
    const search = U.normalizar(filters && filters.search ? filters.search : "");
    const base = filters && filters.base ? filters.base : "all";
    const date = filters && filters.date ? filters.date : "all";
    const reason = filters && filters.reason ? filters.reason : "all";

    return (rows || []).filter(function (item) {
      const matchesBase = base === "all" || item.base === base;
      const matchesDate = date === "all" || item.date === date;
      const matchesReason = reason === "all" || item.reason === reason;

      const matchesSearch =
        !search ||
        U.normalizar(item.base).includes(search) ||
        U.normalizar(item.driver).includes(search) ||
        U.normalizar(item.reason).includes(search) ||
        U.normalizar(item.date).includes(search);

      return matchesBase && matchesDate && matchesReason && matchesSearch;
    });
  }

  function buildSummary(rows) {
    const baseRank = groupCount(rows, "base");
    const dateRank = groupCount(rows, "date");
    const reasonRank = groupCount(rows, "reason");

    const totalInsucessos = rows.length;
    const totalBases = new Set(rows.map(function (item) { return item.base; })).size;
    const totalDatas = new Set(rows.map(function (item) { return item.date; })).size;

    return {
      totalInsucessos: totalInsucessos,
      totalBases: totalBases,
      totalDatas: totalDatas,
      topReason: reasonRank.length ? reasonRank[0].label : "--",
      topBase: baseRank.length ? baseRank[0].label : "--",
      topDate: dateRank.length ? dateRank[0].label : "--",
      avgPerBase: totalBases ? totalInsucessos / totalBases : 0,
      avgPerDate: totalDatas ? totalInsucessos / totalDatas : 0
    };
  }

  function sortDatesBR(values) {
    return values.slice().sort(function (a, b) {
      function toDate(text) {
        const parts = String(text).split("/");
        if (parts.length !== 3) return new Date("2100-12-31");
        return new Date(parts[2] + "-" + parts[1] + "-" + parts[0] + "T00:00:00");
      }
      return toDate(a) - toDate(b);
    });
  }

  function getSeverityByValue(value, warningThreshold, dangerThreshold) {
    const total = Number(value || 0);
    const warning = Number(warningThreshold || 3);
    const danger = Number(dangerThreshold || 6);

    if (total >= danger) return "danger";
    if (total >= warning) return "warning";
    return "success";
  }

  function severityLabel(level) {
    if (level === "danger") return "Crítico";
    if (level === "warning") return "Atenção";
    return "Controlado";
  }

  function buildInsightText(rows) {
    if (!rows.length) {
      return {
        main: "Importe os arquivos da semana para começar a análise.",
        base: "Sem dados.",
        reason: "Sem dados."
      };
    }

    const baseRank = groupCount(rows, "base");
    const reasonRank = groupCount(rows, "reason");
    const dateRank = groupCount(rows, "date");

    const main = "Foram encontrados " + rows.length + " insucesso(s), distribuídos em " +
      new Set(rows.map(function (item) { return item.base; })).size + " base(s) e " +
      new Set(rows.map(function (item) { return item.date; })).size + " data(s).";

    const base = baseRank.length
      ? baseRank[0].label + " lidera com " + baseRank[0].total + " insucesso(s)."
      : "Sem base em destaque.";

    const reason = reasonRank.length
      ? reasonRank[0].label + " apareceu " + reasonRank[0].total + " vez(es)."
      : "Sem motivo em destaque.";

    if (dateRank.length) {
      return {
        main: main,
        base: base,
        reason: reason
      };
    }

    return {
      main: main,
      base: base,
      reason: reason
    };
  }

  window.CTInsucessosMetrics = {
    inspectFiles: inspectFiles,
    groupCount: groupCount,
    groupDrivers: groupDrivers,
    filterRows: filterRows,
    buildSummary: buildSummary,
    sortDatesBR: sortDatesBR,
    getSeverityByValue: getSeverityByValue,
    severityLabel: severityLabel,
    buildInsightText: buildInsightText
  };
})();