(function () {
  "use strict";

  // ================================================================
  // Regras de negócio compartilhadas entre excel.js, metrics.js,
  // insucessos-metrics.js e acompanhamento-geral.js: nomes de coluna
  // aceitos na planilha, mapa de regionais por base e a classificação
  // de uma linha em "entregue" / "insucesso" / "pendente". Manter isso
  // em um único lugar evita que Dashboard e Insucessos contem os
  // mesmos dados de formas diferentes.
  // ================================================================

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

  // Único motivo de coluna M que conta como insucesso "de verdade" para
  // fins de SLA. H/I não passam por este filtro (ver classifyDetailedRow).
  const ALLOWED_INSUCESSO_REASONS = [
    "Endereço incorreto",
    "Ausência do destinatário",
    "Recusa de recebimento pelo cliente (destinatário)",
    "Impossibilidade de chegar no endereço informado",
    "Destinatário mudou de endereço"
  ];

  const REGIONAIS = {
    claudio: ["S-CRDR-SP", "GRU-SP", "S-CSVD-SP", "S-BRFD-SP", "S-FREG-SP", "F GRU-SP", "S-BRAS-SP", "F S-JRG-SP", "F S-VLMR-SP", "GRU 03-SP", "S-VLGUI-SP", "F S-BRSL-SP", "F S-BLV-SP"],
    rodrigo: ["S-SAPOP-SP", "S-PENHA-SP", "S-MGUE-SP", "MGC-SP", "ARJ-SP", "SDR-SP", "S-SRAF-SP", "F ITQ-SP", "F S-PENHA-SP", "F S-PENHA 02-SP", "F S-MGUE-SP"],
    neto: ["CARAP-SP", "CHM-SP", "COT-SP", "JDR-SP", "OSC-SP", "S-VLANA-SP", "S-VLLEO-SP", "S-VLSN-SP", "TBA-SP", "VRG-SP"],
    luana: ["AME-SP", "FRCLR-SP", "F VCP-SP", "MGG-SP", "PIR-SP", "RCLR-SP", "SMR-SP", "VCP 03-SP", "VCP 05-SP", "VIN-SP", "FJND-SP", "ITUP-SP", "JND-SP", "BRG-SP", "CAIE-SP", "ATB-SP", "F SOD 02-SP", "IBUN-SP", "ITPT-SP", "ITPV-SP", "ITU-SP", "SOD02-SP", "SOD-SP", "SRQ-SP", "INDTR SD"]
  };

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

  // Remove prefixo de código ("05-Endereço incorreto" -> "Endereço incorreto")
  // e normaliza espaços, mantendo o texto legível (sem acentuar caixa alta).
  function cleanReasonText(value) {
    if (value === null || value === undefined) return "";

    let text = String(value).trim();
    if (!text) return "";

    const hyphenIndex = text.indexOf("-");
    if (hyphenIndex >= 0) {
      text = text.slice(hyphenIndex + 1);
    }

    return text
      .replace(/[._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeReasonKey(value) {
    return U.normalizar(cleanReasonText(value));
  }

  function isAllowedInsucessoReason(value) {
    const normalizedValue = normalizeReasonKey(value);
    if (!normalizedValue) return false;

    return ALLOWED_INSUCESSO_REASONS.some(function (reason) {
      return normalizedValue.includes(U.normalizar(reason));
    });
  }

  // Classificação por posição/alias das colunas H, I, J e M.
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

    if (hasM) {
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

  // Planilhas antigas, sem colunas H/I/J/M: usa "Horário da entrega" /
  // "Motivos dos pacotes problemáticos".
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

  // Ponto único usado por excel.js (Dashboard) e insucessos-metrics.js
  // (Insucessos) para decidir o status de uma linha detalhada (não-resumo).
  function classifyRowStatus(rawRow) {
    const byColumns = classifyDetailedRow(rawRow);

    const hasColumnSignals =
      byColumns.status !== "pendente" ||
      isFilledValue(getColumnValue(rawRow, 7, COLUMN_GROUPS.columnH)) ||
      isFilledValue(getColumnValue(rawRow, 8, COLUMN_GROUPS.columnI)) ||
      isFilledValue(getColumnValue(rawRow, 9, COLUMN_GROUPS.columnJ)) ||
      isFilledValue(getColumnValue(rawRow, 12, COLUMN_GROUPS.columnM));

    return hasColumnSignals ? byColumns : classifyLegacyDetailedRow(rawRow);
  }

  function getRegionalFromBase(baseName) {
    const normalizedBase = U.normalizar(baseName);

    if (REGIONAIS.claudio.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Claudio";
    if (REGIONAIS.rodrigo.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Rodrigo";
    if (REGIONAIS.neto.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Neto";
    if (REGIONAIS.luana.some(function (b) { return U.normalizar(b) === normalizedBase; })) return "Luana";

    return "Não definida";
  }

  window.CTDomain = {
    COLUMN_GROUPS: COLUMN_GROUPS,
    ALLOWED_INSUCESSO_REASONS: ALLOWED_INSUCESSO_REASONS,
    REGIONAIS: REGIONAIS,
    getField: getField,
    getFieldByColumnIndex: getFieldByColumnIndex,
    getColumnValue: getColumnValue,
    isFilledValue: isFilledValue,
    cleanReasonText: cleanReasonText,
    normalizeReasonKey: normalizeReasonKey,
    isAllowedInsucessoReason: isAllowedInsucessoReason,
    classifyDetailedRow: classifyDetailedRow,
    classifyLegacyDetailedRow: classifyLegacyDetailedRow,
    classifyRowStatus: classifyRowStatus,
    getRegionalFromBase: getRegionalFromBase
  };
})();
