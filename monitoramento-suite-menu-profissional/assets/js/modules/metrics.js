(function () {
  "use strict";

  const U = window.CTUtils;
  const Excel = window.CTExcel || {};

  const REGIONAIS = {
    claudio: ["S-CRDR-SP", "GRU-SP", "S-CSVD-SP", "S-BRFD-SP", "S-FREG-SP", "F GRU-SP", "S-BRAS-SP", "F S-JRG-SP", "F S-VLMR-SP", "GRU 03-SP", "S-VLGUI-SP", "F S-BRSL-SP", "F S-BLV-SP"],
    rodrigo: ["S-SAPOP-SP", "S-PENHA-SP", "S-MGUE-SP", "MGC-SP", "ARJ-SP", "SDR-SP", "S-SRAF-SP", "F ITQ-SP", "F S-PENHA-SP", "F S-PENHA 02-SP", "F S-MGUE-SP"],
    neto: ["CARAP-SP", "CHM-SP", "COT-SP", "JDR-SP", "OSC-SP", "S-VLANA-SP", "S-VLLEO-SP", "S-VLSN-SP", "TBA-SP", "VRG-SP"],
    luana: ["AME-SP", "FRCLR-SP", "F VCP-SP", "MGG-SP", "PIR-SP", "RCLR-SP", "SMR-SP", "VCP 03-SP", "VCP 05-SP", "VIN-SP", "FJND-SP", "ITUP-SP", "JND-SP", "BRG-SP", "CAIE-SP", "ATB-SP", "F SOD 02-SP", "IBUN-SP", "ITPT-SP", "ITPV-SP", "ITU-SP", "SOD02-SP", "SOD-SP", "SRQ-SP", "INDTR SD"]
  };

  const ALLOWED_INSUCESSO_REASONS = [
    "Endereço incorreto",
    "Ausência do destinatário",
    "Recusa de recebimento pelo cliente (destinatário)",
    "Impossibilidade de chegar no endereço informado",
    "Destinatário mudou de endereço"
  ];

  function getRegionalFromBase(baseName) {
    const normalizedBase = U.normalizar(baseName);

    if (REGIONAIS.claudio.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Claudio";
    if (REGIONAIS.rodrigo.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Rodrigo";
    if (REGIONAIS.neto.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Neto";
    if (REGIONAIS.luana.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Luana";

    return "Não definida";
  }

  function getField(row, keys) {
    if (!row || typeof row !== "object") return null;

    if (Excel.getField) {
      return Excel.getField(row, keys);
    }

    const keyList = Array.isArray(keys) ? keys : [keys];

    for (let i = 0; i < keyList.length; i += 1) {
      if (Object.prototype.hasOwnProperty.call(row, keyList[i])) {
        return row[keyList[i]];
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

  function classifyByColumns(row) {
    const valueH = getColumnValue(row, 7, ["H", "Coluna H", "Status H", "Motivo H", "Ocorrência H", "Ocorrencia H"]);
    const valueI = getColumnValue(row, 8, ["I", "Coluna I", "Status I", "Motivo I", "Ocorrência I", "Ocorrencia I"]);
    const valueJ = getColumnValue(row, 9, ["J", "Coluna J", "Data Baixa", "Baixa", "Comprovante", "Entrega", "Data Entrega"]);
    const valueM = getColumnValue(row, 12, ["M", "Coluna M", "Status M", "Motivo M", "Ocorrência M", "Ocorrencia M"]);

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

    const hasExplicitColumnM = hasM || isFilledValue(getColumnValue(row, 12, ["M", "Coluna M"]));
    if (hasExplicitColumnM) {
      return {
        status: "pendente",
        deliveredTime: "",
        problemReason: ""
      };
    }

    if (isFilledValue(valueH) || isFilledValue(valueI)) {
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

  function classifyLegacy(row) {
    const deliveredTime = getField(row, ["Horário da entrega", "Horario da entrega", "deliveredTime"]);
    const problemReason = getField(row, [
      "Motivos dos pacotes problemáticos",
      "Motivos dos pacotes problematicos",
      "Pacote problemático",
      "Pacote problematico",
      "problemReason"
    ]);

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

  function startsWithNormalized(text, prefix) {
    return U.normalizar(text).startsWith(U.normalizar(prefix));
  }

  function startsWithAnyNormalized(text, terms) {
    return terms.some(function (term) {
      return startsWithNormalized(text, term);
    });
  }

  function containsNormalized(text, term) {
    return U.normalizar(text).includes(U.normalizar(term));
  }

  function getDisplayBaseFromBaseAndDriver(baseName, driverName) {
    const base = String(baseName || "").trim();
    const driver = String(driverName || "").trim();

    if (!base) return "BASE INDEFINIDA";
    if (!driver) return base;

    const baseN = U.normalizar(base);

    function withGroup(groupName) {
      return base + " (" + groupName + ")";
    }

    // GRU-SP
    if (baseN === U.normalizar("GRU-SP")) {
      if (startsWithAnyNormalized(driver, [
        "ETC TRANSFACIL EXPRESS",
        "TRANSFACIL EXPRESS"
      ])) {
        return withGroup("TRANFACIL");
      }
      return base;
    }

    // GRU 03-SP
    if (baseN === U.normalizar("GRU 03-SP")) {
      if (startsWithAnyNormalized(driver, [
        "M EXPRESS",
        "ETC M EXPRESS"
      ])) {
        return withGroup("M EXPRESS");
      }

      if (startsWithAnyNormalized(driver, [
        "ETC TRANFACIL",
        "ETC TRANFÁCIL",
        "TRANFACIL",
        "TRANFÁCIL"
      ])) {
        return withGroup("TRANFACIL");
      }

      return base;
    }

    
    // S-CSVD-SP
    if (baseN === U.normalizar("S-CSVD-SP")) {
      if (startsWithAnyNormalized(driver, [
        "PRADO EXPRESS",
        "ETC PRADO EXPRESS"
      ])) {
        return withGroup("PRADO");
      }
      return base;
    }

    // S-FREG-SP
    if (baseN === U.normalizar("S-FREG-SP")) {
      if (startsWithAnyNormalized(driver, [
        "LUANA LINS EXPRESS"
      ])) {
        return withGroup("LUANA LINS");
      }
      return base;
    }

    // S-PENHA-SP
    if (baseN === U.normalizar("S-PENHA-SP")) {
      if (startsWithAnyNormalized(driver, [
        "GUILHERME EXPRESS",
        "ETC GUILHERME EXPRESS"
      ])) {
        return withGroup("GUILHERME");
      }

      if (
        containsNormalized(driver, "TRANSFACIL EXPRESS") ||
        containsNormalized(driver, "TRANFACIL EXPRESS") ||
        containsNormalized(driver, "TRANSFÁCIL EXPRESS") ||
        containsNormalized(driver, "TRANFÁCIL EXPRESS")
      ) {
        return withGroup("TRANFACIL");
      }

      if (startsWithAnyNormalized(driver, [
        "FLIGHTCARGO",
        "FLIGHT CARGO"
      ])) {
        return withGroup("FLIGHTCARGO");
      }

      if (startsWithAnyNormalized(driver, [
        "GFS EXPRESS",
        "ETC GFS EXPRESS"
      ])) {
        return withGroup("GFS");
      }

      return base;
    }

    // F S-PENHA 02-SP
    if (baseN === U.normalizar("F S-PENHA 02-SP")) {
      if (startsWithAnyNormalized(driver, [
        "GUILHERME EXPRESS",
        "ETC GUILHERME EXPRESS"
      ])) {
        return withGroup("GUILHERME");
      }

      if (startsWithAnyNormalized(driver, [
        "TRANFACIL EXPRESS",
        "TRANFÁCIL EXPRESS",
        "ETC TRANFACIL",
        "ETC TRANFÁCIL"
      ])) {
        return withGroup("TRANFACIL");
      }

      if (startsWithAnyNormalized(driver, [
        "FLIGHTCARGO",
        "FLIGHT CARGO"
      ])) {
        return withGroup("FLIGHTCARGO");
      }

      if (startsWithAnyNormalized(driver, [
        "GFS EXPRESS",
        "ETC GFS EXPRESS"
      ])) {
        return withGroup("GFS");
      }

      return base;
    }

    // S-SRAF-SP
    if (baseN === U.normalizar("S-SRAF-SP")) {
      if (startsWithAnyNormalized(driver, [
        "GUILHERME EXPRESS"
      ])) {
        return withGroup("GUILHERME");
      }

      if (startsWithAnyNormalized(driver, [
        "TRANSFACIL EXPRESS",
        "TRANFACIL EXPRESS",
        "TRANSFÁCIL EXPRESS",
        "TRANFÁCIL EXPRESS",
        "ETC TRANFACIL",
        "ETC TRANFÁCIL",
        "ETC TRANSFACIL",
        "ETC TRANSFÁCIL"
      ])) {
        return withGroup("TRANFACIL");
      }

      if (startsWithAnyNormalized(driver, [
        "JIREH EXPRESS",
        "ETC JIREH EXPRESS",
        "ETC JIREH"
      ])) {
        return withGroup("JIREH");
      }

      if (startsWithAnyNormalized(driver, [
        "ETC GIRE EXPRESS",
        "ETC GIRE"
      ])) {
        return withGroup("GIRE");
      }

      return base;
    }

    // S-SAPOP-SP
    if (baseN === U.normalizar("S-SAPOP-SP")) {
      if (startsWithAnyNormalized(driver, [
        "GUILHERME EXPRESS"
      ])) {
        return withGroup("GUILHERME");
      }

      return base;
    }

    return base;
  }

  function normalizeLegacyRow(row) {
    if (!row || typeof row !== "object") {
      return {
        baseOriginal: "BASE INDEFINIDA",
        base: "BASE INDEFINIDA",
        driver: "NÃO ATRIBUÍDO",
        regional: "Não definida",
        deliveredTime: "",
        problemReason: "",
        total: 0,
        delivered: 0,
        undelivered: 0,
        problematic: 0,
        pending: 0,
        isSummary: false,
        status: "pendente",
        isValid: false,
        raw: row
      };
    }

    if ("base" in row && "driver" in row && "status" in row) {
      const originalBase = String(row.baseOriginal || row.base || "BASE INDEFINIDA").trim();
      const driver = String(row.driver || "NÃO ATRIBUÍDO").trim();
      const displayBase = getDisplayBaseFromBaseAndDriver(originalBase, driver);

      return {
        baseOriginal: originalBase,
        base: displayBase,
        driver: driver,
        regional: String(row.regional || getRegionalFromBase(originalBase)).trim(),
        deliveredTime: String(row.deliveredTime || "").trim(),
        problemReason: String(row.problemReason || "").trim(),
        total: U.toNumber(row.total),
        delivered: U.toNumber(row.delivered),
        undelivered: U.toNumber(row.undelivered),
        problematic: U.toNumber(row.problematic),
        pending: U.toNumber(row.pending),
        isSummary: Boolean(row.isSummary),
        status: String(row.status || "pendente").trim(),
        isValid: "isValid" in row ? Boolean(row.isValid) : true,
        raw: row.raw || row
      };
    }

    const originalBase = String(
      getField(row, ["Base de entrega", "Base", "base"]) || "BASE INDEFINIDA"
    ).trim();

    const driver = String(
      getField(row, ["Entregador", "Motorista", "Courier", "Driver", "driver"]) || "NÃO ATRIBUÍDO"
    ).trim();

    const regional = String(
      getField(row, ["Regional", "regional"]) || getRegionalFromBase(originalBase)
    ).trim();

    const total = U.toNumber(getField(row, ["Número total de expedido", "Numero total de expedido", "Total Expedido", "EXPEDIDO", "Expedido", "total"]));
    const delivered = U.toNumber(getField(row, ["Número de pacotes assinados", "Numero de pacotes assinados", "Pacotes assinados", "Entregues", "ENTREGUE", "Entregue", "delivered"]));
    const undelivered = U.toNumber(getField(row, ["Não entregue", "Nao entregue", "BAIXA PENDENTE", "Baixa pendente", "Baixa Pendente", "undelivered"]));
    const problematic = U.toNumber(getField(row, ["Pacote problemático", "Pacote problematico", "Problemático", "Problematico", "INSUCESSO", "Insucesso", "problematic"]));
    const pending = U.toNumber(getField(row, ["Pacote não expedido", "Pacote nao expedido", "Não expedido", "Nao expedido", "Pendente", "pending"]));

    const isSummary = total > 0 || delivered > 0 || undelivered > 0 || problematic > 0 || pending > 0;
    const displayBase = getDisplayBaseFromBaseAndDriver(originalBase, driver);

    if (isSummary) {
      return {
        baseOriginal: originalBase,
        base: displayBase,
        driver: driver,
        regional: regional || getRegionalFromBase(originalBase),
        deliveredTime: "",
        problemReason: "",
        total: total,
        delivered: delivered,
        undelivered: undelivered,
        problematic: problematic,
        pending: pending,
        isSummary: true,
        status: "resumo",
        isValid: originalBase !== "BASE INDEFINIDA",
        raw: row
      };
    }

    const source = row.raw && typeof row.raw === "object" ? row.raw : row;
    const byColumns = classifyByColumns(source);

    const hasColumnSignals =
      byColumns.status !== "pendente" ||
      isFilledValue(getColumnValue(source, 7, ["H", "Coluna H"])) ||
      isFilledValue(getColumnValue(source, 8, ["I", "Coluna I"])) ||
      isFilledValue(getColumnValue(source, 9, ["J", "Coluna J"])) ||
      isFilledValue(getColumnValue(source, 12, ["M", "Coluna M"]));

    const detailed = hasColumnSignals ? byColumns : classifyLegacy(source);

    return {
      baseOriginal: originalBase,
      base: displayBase,
      driver: driver,
      regional: regional || getRegionalFromBase(originalBase),
      deliveredTime: detailed.deliveredTime,
      problemReason: detailed.problemReason,
      total: 0,
      delivered: detailed.status === "entregue" ? 1 : 0,
      undelivered: 0,
      problematic: detailed.status === "insucesso" ? 1 : 0,
      pending: detailed.status === "pendente" ? 1 : 0,
      isSummary: false,
      status: detailed.status,
      isValid: originalBase !== "BASE INDEFINIDA",
      raw: source
    };
  }

  function aggregateBaseMetrics(rows) {
    const grouped = {};

    U.safeArray(rows).forEach(function (sourceRow) {
      const row = normalizeLegacyRow(sourceRow);
      const displayBase = row.base || "BASE INDEFINIDA";

      if (!grouped[displayBase]) {
        grouped[displayBase] = {
          baseOriginal: row.baseOriginal || displayBase,
          base: displayBase,
          regional: row.regional || getRegionalFromBase(row.baseOriginal || displayBase),
          total: 0,
          entregue: 0,
          problematico: 0,
          naoEntregue: 0,
          pendente: 0,
          insucesso: 0,
          taxa: 0
        };
      }

      if (row.isSummary) {
        grouped[displayBase].total += row.total;
        grouped[displayBase].entregue += row.delivered;
        grouped[displayBase].naoEntregue += row.undelivered;
        grouped[displayBase].problematico += row.problematic;
        grouped[displayBase].pendente += row.pending;
      } else {
        grouped[displayBase].total += 1;

        if (row.status === "entregue") {
          grouped[displayBase].entregue += 1;
        } else if (row.status === "insucesso") {
          grouped[displayBase].problematico += 1;
        } else {
          grouped[displayBase].pendente += 1;
        }
      }

      grouped[displayBase].insucesso = grouped[displayBase].problematico + grouped[displayBase].naoEntregue;
      grouped[displayBase].taxa = grouped[displayBase].total > 0
        ? (grouped[displayBase].entregue / grouped[displayBase].total) * 100
        : 0;
    });

    return Object.values(grouped).sort(function (a, b) {
      return a.base.localeCompare(b.base, "pt-BR");
    });
  }

  function aggregateGlobal(rows) {
    return aggregateBaseMetrics(rows).reduce(function (acc, item) {
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

  function aggregateDrivers(rows) {
    const grouped = {};

    U.safeArray(rows).forEach(function (sourceRow) {
      const row = normalizeLegacyRow(sourceRow);
      if (row.isSummary) return;

      const safeBase = row.base || "BASE INDEFINIDA";
      const safeDriver = row.driver && row.driver !== "NÃO ATRIBUÍDO"
        ? row.driver
        : "NÃO ATRIBUÍDO";

      const key = safeBase + "__" + safeDriver;

      if (!grouped[key]) {
        grouped[key] = {
          baseOriginal: row.baseOriginal || safeBase,
          base: safeBase,
          driver: safeDriver,
          total: 0,
          entregue: 0,
          pendente: 0,
          insucesso: 0,
          taxa: 0
        };
      }

      grouped[key].total += 1;

      if (row.status === "entregue") {
        grouped[key].entregue += 1;
      } else if (row.status === "insucesso") {
        grouped[key].insucesso += 1;
      } else {
        grouped[key].pendente += 1;
      }

      grouped[key].taxa = grouped[key].total > 0
        ? (grouped[key].entregue / grouped[key].total) * 100
        : 0;
    });

    return Object.values(grouped).sort(function (a, b) {
      if (a.base !== b.base) return a.base.localeCompare(b.base, "pt-BR");
      return a.driver.localeCompare(b.driver, "pt-BR");
    });
  }

  function filterMetrics(metrics, filters) {
    const regional = filters && filters.regional ? filters.regional : "all";
    const base = filters && filters.base ? filters.base : "all";
    const status = filters && filters.status ? filters.status : "all";
    const target = Number(filters && filters.target) || 90;
    const search = U.normalizar(filters && filters.search ? filters.search : "");

    return U.safeArray(metrics).filter(function (item) {
      const matchesRegional = regional === "all" || item.regional === regional;
      const matchesBase = base === "all" || item.base === base;
      const matchesSearch = !search || U.normalizar(item.base).includes(search);

      let matchesStatus = true;
      if (status === "critical") matchesStatus = item.taxa < target;
      if (status === "healthy") matchesStatus = item.taxa >= target;

      return matchesRegional && matchesBase && matchesStatus && matchesSearch;
    });
  }

  window.CTMetrics = {
    REGIONAIS: REGIONAIS,
    normalizeLegacyRow: normalizeLegacyRow,
    getRegionalFromBase: getRegionalFromBase,
    getDisplayBaseFromBaseAndDriver: getDisplayBaseFromBaseAndDriver,
    aggregateBaseMetrics: aggregateBaseMetrics,
    aggregateGlobal: aggregateGlobal,
    aggregateDrivers: aggregateDrivers,
    filterMetrics: filterMetrics
  };
})();