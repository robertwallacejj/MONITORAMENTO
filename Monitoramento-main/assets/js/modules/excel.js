(function () {
  "use strict";

  const U = window.CTUtils;

  const COLUMN_GROUPS = {
    base: ["Base de entrega", "Base", "base"],
    driver: ["Entregador", "Motorista", "Courier", "Driver", "driver"],
    regional: ["Regional", "regional"],

    total: [
      "Número total de expedido",
      "Numero total de expedido",
      "Total Expedido",
      "EXPEDIDO",
      "Expedido",
      "total"
    ],
    signed: [
      "Número de pacotes assinados",
      "Numero de pacotes assinados",
      "Pacotes assinados",
      "Entregues",
      "ENTREGUE",
      "Entregue",
      "delivered"
    ],
    undelivered: [
      "Não entregue",
      "Nao entregue",
      "BAIXA PENDENTE",
      "Baixa pendente",
      "Baixa Pendente",
      "undelivered"
    ],
    problematic: [
      "Pacote problemático",
      "Pacote problematico",
      "Problemático",
      "Problematico",
      "INSUCESSO",
      "Insucesso",
      "problematic"
    ],
    pending: [
      "Pacote não expedido",
      "Pacote nao expedido",
      "Não expedido",
      "Nao expedido",
      "Pendente",
      "pending"
    ],

    columnH: ["H", "Coluna H", "Status H", "Motivo H", "Ocorrência H", "Ocorrencia H"],
    columnI: ["I", "Coluna I", "Status I", "Motivo I", "Ocorrência I", "Ocorrencia I"],
    columnJ: ["J", "Coluna J", "Data Baixa", "Baixa", "Comprovante", "Entrega", "Data Entrega"],
    columnM: ["M", "Coluna M", "Status M", "Motivo M", "Ocorrência M", "Ocorrencia M"],

    deliveredTime: ["Horário da entrega", "Horario da entrega", "deliveredTime"],
    problemReason: [
      "Motivos dos pacotes problemáticos",
      "Motivos dos pacotes problematicos",
      "Pacote problemático",
      "Pacote problematico",
      "problemReason"
    ]
  };

  const ALLOWED_INSUCESSO_REASONS = [
    "Endereço incorreto",
    "Ausência do destinatário",
    "Recusa de recebimento pelo cliente (destinatário)",
    "Impossibilidade de chegar no endereço informado",
    "Destinatário mudou de endereço"
  ];

  function getField(row, keys) {
    if (!row || typeof row !== "object") return null;

    const keyList = Array.isArray(keys) ? keys : [keys];

    for (let i = 0; i < keyList.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(row, keyList[i])) {
        return row[keyList[i]];
      }
    }

    const normalizedTargets = keyList.map(function (item) {
      return U.normalizar(String(item || ""));
    });

    const rowKeys = Object.keys(row);

    for (let i = 0; i < rowKeys.length; i += 1) {
      const key = rowKeys[i];
      if (normalizedTargets.includes(U.normalizar(String(key || "")))) {
        return row[key];
      }
    }

    return null;
  }

  function getFieldByColumnIndex(row, index) {
    if (!row) return null;

    if (Array.isArray(row)) {
      return row[index];
    }

    if (typeof row === "object") {
      if (Object.prototype.hasOwnProperty.call(row, index)) return row[index];
      if (Object.prototype.hasOwnProperty.call(row, String(index))) return row[String(index)];

      const values = Object.values(row);
      if (index >= 0 && index < values.length) {
        return values[index];
      }
    }

    return null;
  }

  function getColumnValue(row, index, aliases) {
    const byIndex = getFieldByColumnIndex(row, index);
    if (byIndex !== null && byIndex !== undefined && byIndex !== "") return byIndex;

    const byAlias = getField(row, aliases);
    if (byAlias !== null && byAlias !== undefined) return byAlias;

    return "";
  }

  function isFilledValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return !Number.isNaN(value);
    if (typeof value === "boolean") return value === true;

    const text = String(value).trim();
    if (!text) return false;

    const normalized = U.normalizar(text);
    const emptyTokens = ["SEMVALOR", "NULL", "UNDEFINED", "NA", "N/A", "-"];

    return !emptyTokens.includes(normalized);
  }

  function normalizeReasonText(value) {
    if (value === null || value === undefined) return "";

    let text = String(value).trim();
    if (!text) return "";

    const hyphenIndex = text.indexOf("-");
    if (hyphenIndex >= 0) {
      text = text.slice(hyphenIndex + 1);
    }

    text = text
      .replace(/[._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return U.normalizar(text);
  }

  function isAllowedInsucessoReason(value) {
    const normalizedValue = normalizeReasonText(value);
    if (!normalizedValue) return false;

    return ALLOWED_INSUCESSO_REASONS.some(function (reason) {
      return normalizedValue.includes(U.normalizar(reason));
    });
  }

  function hasAnyColumn(headers, aliases) {
    const normalizedHeaders = headers.map(function (item) {
      return U.normalizar(String(item || ""));
    });

    return aliases.some(function (alias) {
      return normalizedHeaders.includes(U.normalizar(String(alias || "")));
    });
  }

  function getMissingColumns(headers) {
    return {
      base: hasAnyColumn(headers, COLUMN_GROUPS.base) ? [] : ["Base de entrega"],
      detailed: [
        hasAnyColumn(headers, COLUMN_GROUPS.driver) ? null : "Entregador",
        hasAnyColumn(headers, COLUMN_GROUPS.columnH) ? null : "Coluna H",
        hasAnyColumn(headers, COLUMN_GROUPS.columnI) ? null : "Coluna I",
        hasAnyColumn(headers, COLUMN_GROUPS.columnJ) ? null : "Coluna J"
      ].filter(Boolean),
      summary: [
        hasAnyColumn(headers, COLUMN_GROUPS.total) ? null : "Número total de expedido",
        hasAnyColumn(headers, COLUMN_GROUPS.signed) ? null : "Número de pacotes assinados",
        hasAnyColumn(headers, COLUMN_GROUPS.undelivered) ? null : "Não entregue",
        hasAnyColumn(headers, COLUMN_GROUPS.problematic) ? null : "Pacote problemático"
      ].filter(Boolean)
    };
  }

  function scoreSheet(headers) {
    let score = 0;

    Object.keys(COLUMN_GROUPS).forEach(function (key) {
      if (hasAnyColumn(headers, COLUMN_GROUPS[key])) score += 2;
    });

    const missing = getMissingColumns(headers);
    if (missing.base.length === 0) score += 5;
    if (missing.detailed.length <= 1) score += 6;
    if (missing.summary.length <= 2) score += 4;

    return score;
  }

  function analyzeWorkbook(file, arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    const sheets = workbook.SheetNames.map(function (sheetName) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const headers = rows.length ? Object.keys(rows[0]) : [];
      const sheetScore = scoreSheet(headers);

      return {
        fileName: file.name,
        workbook: workbook,
        sheetName: sheetName,
        headers: headers,
        rawRows: rows,
        score: sheetScore,
        ignored: sheetScore === 0 || rows.length === 0
      };
    });

    const relevantSheets = sheets.filter(function (item) {
      return !item.ignored;
    });

    const selected = relevantSheets.sort(function (a, b) {
      return b.score - a.score;
    })[0] || sheets[0] || null;

    return {
      fileName: file.name,
      workbook: workbook,
      sheets: sheets,
      selectedSheetName: selected ? selected.sheetName : "",
      ignoredSheets: sheets.filter(function (item) {
        return item.ignored;
      }).length
    };
  }

  function classifyDetailedRow(rawRow) {
    const valueH = getColumnValue(rawRow, 7, COLUMN_GROUPS.columnH);
    const valueI = getColumnValue(rawRow, 8, COLUMN_GROUPS.columnI);
    const valueJ = getColumnValue(rawRow, 9, COLUMN_GROUPS.columnJ);
    const valueM = getColumnValue(rawRow, 12, COLUMN_GROUPS.columnM);

    const hasH = isFilledValue(valueH);
    const hasI = isFilledValue(valueI);
    const hasJ = isFilledValue(valueJ);
    const hasM = isFilledValue(valueM);
    const allowedM = hasM && isAllowedInsucessoReason(valueM);

    if (hasJ) {
      return {
        status: "entregue",
        deliveredTime: String(valueJ || "").trim(),
        problemReason: ""
      };
    }

    if (hasM && allowedM) {
      return {
        status: "insucesso",
        deliveredTime: "",
        problemReason: String(valueM || "").trim()
      };
    }

    const hasExplicitColumnM = hasM || isFilledValue(getColumnValue(rawRow, 12, COLUMN_GROUPS.columnM));
    if (hasExplicitColumnM) {
      return {
        status: "pendente",
        deliveredTime: "",
        problemReason: ""
      };
    }

    if (hasH || hasI) {
      return {
        status: "insucesso",
        deliveredTime: "",
        problemReason: String(valueH || valueI || "").trim()
      };
    }

    return {
      status: "pendente",
      deliveredTime: "",
      problemReason: ""
    };
  }

  function classifyLegacyDetailedRow(rawRow) {
    const deliveredTime = getField(rawRow, COLUMN_GROUPS.deliveredTime);
    const problemReason = getField(rawRow, COLUMN_GROUPS.problemReason);

    if (isFilledValue(deliveredTime)) {
      return {
        status: "entregue",
        deliveredTime: String(deliveredTime || "").trim(),
        problemReason: ""
      };
    }

    if (isFilledValue(problemReason)) {
      return {
        status: "insucesso",
        deliveredTime: "",
        problemReason: String(problemReason || "").trim()
      };
    }

    return {
      status: "pendente",
      deliveredTime: "",
      problemReason: ""
    };
  }

  function classifyRow(rawRow) {
    const base = String(getField(rawRow, COLUMN_GROUPS.base) || "BASE INDEFINIDA").trim();
    const driver = String(getField(rawRow, COLUMN_GROUPS.driver) || "NÃO ATRIBUÍDO").trim();
    const regional = String(getField(rawRow, COLUMN_GROUPS.regional) || "").trim();

    const total = U.toNumber(getField(rawRow, COLUMN_GROUPS.total));
    const delivered = U.toNumber(getField(rawRow, COLUMN_GROUPS.signed));
    const undelivered = U.toNumber(getField(rawRow, COLUMN_GROUPS.undelivered));
    const problematic = U.toNumber(getField(rawRow, COLUMN_GROUPS.problematic));
    const pending = U.toNumber(getField(rawRow, COLUMN_GROUPS.pending));

    const isSummary = total > 0 || delivered > 0 || undelivered > 0 || problematic > 0 || pending > 0;

    if (isSummary) {
      return {
        base: base,
        regional: regional,
        driver: driver,
        deliveredTime: "",
        problemReason: "",
        total: total,
        delivered: delivered,
        undelivered: undelivered,
        problematic: problematic,
        pending: pending,
        isSummary: true,
        status: "resumo",
        isValid: Boolean(base && base !== "BASE INDEFINIDA"),
        raw: rawRow
      };
    }

    const byColumns = classifyDetailedRow(rawRow);
    const hasColumnSignals =
      byColumns.status !== "pendente" ||
      isFilledValue(getColumnValue(rawRow, 7, COLUMN_GROUPS.columnH)) ||
      isFilledValue(getColumnValue(rawRow, 8, COLUMN_GROUPS.columnI)) ||
      isFilledValue(getColumnValue(rawRow, 9, COLUMN_GROUPS.columnJ)) ||
      isFilledValue(getColumnValue(rawRow, 12, COLUMN_GROUPS.columnM));

    const detailed = hasColumnSignals ? byColumns : classifyLegacyDetailedRow(rawRow);

    const isValid = Boolean(base && base !== "BASE INDEFINIDA") &&
      (driver !== "NÃO ATRIBUÍDO" || detailed.status !== "pendente");

    return {
      base: base,
      regional: regional,
      driver: driver,
      deliveredTime: detailed.deliveredTime,
      problemReason: detailed.problemReason,
      total: 0,
      delivered: detailed.status === "entregue" ? 1 : 0,
      undelivered: 0,
      problematic: detailed.status === "insucesso" ? 1 : 0,
      pending: detailed.status === "pendente" ? 1 : 0,
      isSummary: false,
      status: detailed.status,
      isValid: isValid,
      raw: rawRow
    };
  }

  function normalizeRows(rows) {
    const normalizedRows = [];
    const invalidRows = [];

    rows.forEach(function (row, index) {
      const normalized = classifyRow(row);
      normalized.rowIndex = index + 2;

      if (normalized.isValid || normalized.isSummary) normalizedRows.push(normalized);
      else invalidRows.push(normalized);
    });

    return {
      normalizedRows: normalizedRows,
      invalidRows: invalidRows
    };
  }

  function validateSheet(rows) {
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const missing = getMissingColumns(headers);
    const hasBase = missing.base.length === 0;
    const canUseDetailed = missing.detailed.length < 4;
    const canUseSummary = missing.summary.length < 4;

    return {
      headers: headers,
      missing: missing,
      isUsable: hasBase && (canUseDetailed || canUseSummary)
    };
  }

  function summarizeSelection(fileAnalysis, selectedSheetName) {
    const selectedSheet = fileAnalysis.sheets.find(function (item) {
      return item.sheetName === selectedSheetName;
    });

    if (!selectedSheet) {
      return {
        fileName: fileAnalysis.fileName,
        selectedSheetName: "",
        validation: {
          headers: [],
          missing: { base: ["Base de entrega"], detailed: [], summary: [] },
          isUsable: false
        },
        normalizedRows: [],
        invalidRows: [],
        ignoredSheets: fileAnalysis.ignoredSheets
      };
    }

    const validation = validateSheet(selectedSheet.rawRows);
    const normalized = normalizeRows(selectedSheet.rawRows);

    return {
      fileName: fileAnalysis.fileName,
      selectedSheetName: selectedSheetName,
      validation: validation,
      normalizedRows: normalized.normalizedRows,
      invalidRows: normalized.invalidRows,
      ignoredSheets: fileAnalysis.ignoredSheets
    };
  }

  async function inspectFiles(fileList) {
    const files = Array.from(fileList || []);
    const analyses = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      analyses.push(analyzeWorkbook(file, buffer));
    }

    return analyses;
  }

  function buildPreviewReport(analyses, selectedSheetsMap) {
    const files = analyses.map(function (analysis) {
      return summarizeSelection(
        analysis,
        selectedSheetsMap[analysis.fileName] || analysis.selectedSheetName
      );
    });

    const report = files.reduce(function (acc, item) {
      acc.fileCount += 1;
      acc.validRows += item.normalizedRows.length;
      acc.invalidRows += item.invalidRows.length;
      acc.ignoredSheets += item.ignoredSheets;
      return acc;
    }, {
      fileCount: 0,
      validRows: 0,
      invalidRows: 0,
      ignoredSheets: 0
    });

    return {
      files: files,
      report: report
    };
  }

  function mergeImportedRows(currentRows, importedRows, mode) {
    if (mode === "append") {
      return U.safeArray(currentRows).concat(U.safeArray(importedRows));
    }

    return U.safeArray(importedRows);
  }

  function createSampleRows() {
    const sample = [];
    const definitions = [
      { base: "F S-JRG-SP", regional: "Claudio", total: 1257, entregue: 1197, insucesso: 51, pendente: 9 },
      { base: "F ITQ-SP", regional: "Rodrigo", total: 4895, entregue: 4131, insucesso: 206, pendente: 558 }
    ];

    definitions.forEach(function (item) {
      for (let i = 1; i <= item.total; i += 1) {
        let rowStatus = "pendente";

        if (i <= item.entregue) rowStatus = "entregue";
        else if (i <= item.entregue + item.insucesso) rowStatus = "insucesso";

        const raw = {
          Base: item.base,
          Entregador: "Motorista " + String(((i - 1) % 12) + 1).padStart(2, "0"),
          Regional: item.regional,
          H: rowStatus === "insucesso" && i % 2 === 0 ? "Cliente ausente" : "",
          I: rowStatus === "insucesso" && i % 2 !== 0 ? "Endereço incorreto" : "",
          J: rowStatus === "entregue" ? "10:30" : ""
        };

        sample.push({
          base: item.base,
          regional: item.regional,
          driver: raw.Entregador,
          deliveredTime: rowStatus === "entregue" ? "10:30" : "",
          problemReason: rowStatus === "insucesso" ? String(raw.H || raw.I || "") : "",
          total: 0,
          delivered: rowStatus === "entregue" ? 1 : 0,
          undelivered: 0,
          problematic: rowStatus === "insucesso" ? 1 : 0,
          pending: rowStatus === "pendente" ? 1 : 0,
          isSummary: false,
          status: rowStatus,
          isValid: true,
          raw: raw
        });
      }
    });

    return sample;
  }

  window.CTExcel = {
    COLUMN_GROUPS: COLUMN_GROUPS,
    getField: getField,
    inspectFiles: inspectFiles,
    buildPreviewReport: buildPreviewReport,
    mergeImportedRows: mergeImportedRows,
    createSampleRows: createSampleRows
  };
})();