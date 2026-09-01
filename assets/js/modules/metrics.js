(function () {
  "use strict";

  const U = window.CTUtils;
  const D = window.CTDomain;

  const REGIONAIS = D.REGIONAIS;
  const getRegionalFromBase = D.getRegionalFromBase;
  const getField = D.getField;

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
        return withGroup("TRANSFACIL");
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
        return withGroup("TRANSFACIL");
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
        return withGroup("TRANSFACIL");
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
        return withGroup("TRANSFACIL");
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
        return withGroup("TRANSFACIL");
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
    const detailed = D.classifyRowStatus(source);

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
