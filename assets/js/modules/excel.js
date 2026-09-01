(function () {
  "use strict";

  const U = window.CTUtils;
  const D = window.CTDomain;

  const COLUMN_GROUPS = D.COLUMN_GROUPS;
  const getField = D.getField;
  const getFieldByColumnIndex = D.getFieldByColumnIndex;
  const getColumnValue = D.getColumnValue;
  const isFilledValue = D.isFilledValue;

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

    const detailed = D.classifyRowStatus(rawRow);

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
      if (item.validation.isUsable) acc.validSheets += 1;
      else acc.invalidSheets += 1;
      return acc;
    }, {
      fileCount: 0,
      validRows: 0,
      invalidRows: 0,
      ignoredSheets: 0,
      validSheets: 0,
      invalidSheets: 0
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