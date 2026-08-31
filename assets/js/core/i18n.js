(function () {
  "use strict";

  // ================================================================
  // Tradução híbrida PT -> Chinês simplificado
  //
  // Botão no topo de todas as páginas. Ao ativar, o texto fixo da
  // interface passa a aparecer em chinês (linha principal) com o
  // português menor logo abaixo (<ruby>). Números, porcentagens e
  // códigos de base ("F ITQ-SP") ficam intactos.
  //
  // Ordem da tradução: glossário curado -> Google (API pública) ->
  // MyMemory (reserva) -> cache local (localStorage).
  // Conteúdo criado depois (tabelas/cards) é traduzido via
  // MutationObserver. A escolha é lembrada entre páginas.
  // ================================================================

  var STORAGE_ACTIVE = "ct_i18n_hybrid_active_v1";
  var STORAGE_CACHE = "ct_i18n_zh_cache_v1";
  var SL = "pt";
  var TL = "zh-CN";
  var BTN_LABEL = "译 Tradução híbrida em chinês simplificado";
  var BTN_LABEL_ON = "译 Voltar ao português";
  var BTN_LABEL_BUSY = "译 traduzindo…";
  var CONCURRENCY = 3;
  var CACHE_MAX = 4000;
  var MAX_LEN = 900;        // strings maiores que isso não são enviadas à API
  var MYMEMORY_MAX = 480;   // limite prático do endpoint anônimo do MyMemory

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1,
    CANVAS: 1, SVG: 1, CODE: 1, PRE: 1, HEAD: 1, TITLE: 1
  };

  // Glossário curado (tem prioridade sobre a API). Cobre navegação,
  // KPIs e cabeçalhos onde a tradução automática costuma errar.
  var GLOSSARY = {
    "Dashboard": "配送看板",
    "DASHBOARD": "配送看板",
    "Relatórios": "报表",
    "Relatório Geral": "综合报表",
    "RELATÓRIO GERAL": "综合报表",
    "Insucessos": "投递失败",
    "INSUCESSOS": "投递失败",
    "Insucesso": "投递失败",
    "Acompanhamento Geral": "总体跟踪",
    "ACOMPANHAMENTO GERAL": "总体跟踪",
    "Acareação": "投递核对声明",
    "ACAREAÇÃO": "投递核对声明",
    "Menu inicial": "主菜单",
    "Central Operacional": "运营中心",
    "MONITORAMENTO": "配送监控",
    "MONITORAMENTO DE ENTREGAS SP": "圣保罗配送监控",
    "Importar Excel": "导入 Excel",
    "Importar Excels": "导入 Excel 文件",
    "Importar arquivo": "导入文件",
    "Limpar dados locais": "清除本地数据",
    "Limpar": "清除",
    "Apagar histórico": "清除历史记录",
    "Buscar": "搜索",
    "Base": "配送站",
    "Bases": "配送站",
    "Regional": "区域",
    "Motorista": "配送员",
    "Entregador": "配送员",
    "Total Expedido": "发货总数",
    "Total de Bases": "配送站总数",
    "Entregues": "已投递",
    "Entregue": "已投递",
    "Taxa de Entrega": "投递率",
    "Baixa Pendente": "待核销",
    "Pendente": "待处理",
    "Não entregue": "未投递",
    "Não expedido": "未发货",
    "Pacote problemático": "问题包裹",
    "Problemático": "问题件",
    "Meta SLA (%)": "SLA 目标 (%)",
    "SLA consolidado": "综合 SLA",
    "Ranking por base": "配送站排名",
    "Piores primeiro": "最差优先",
    "Melhores primeiro": "最佳优先",
    "Status da importação": "导入状态",
    "Nenhum arquivo selecionado": "未选择文件",
    "Última leitura: --": "最近读取：--",
    "Dados locais: vazios": "本地数据：空",
    "Dados locais: preenchidos": "本地数据：已填充",
    "Salvar em PDF": "保存为 PDF",
    "Preencher exemplo": "填入示例",
    "Voltar ao Dashboard": "返回配送看板"
  };

  var state = {
    active: false,
    busy: false,
    cache: {},
    button: null,
    observer: null,
    observerDepth: 0,
    pendingRoots: [],
    debounce: null,
    titleOriginal: null,
    googleFails: 0,
    googleOff: false,
    quotaHit: false,
    lastMissRatio: 0
  };

  // ---------------------------------------------------------------- cache
  function loadCache() {
    try {
      var raw = localStorage.getItem(STORAGE_CACHE);
      var parsed = raw ? JSON.parse(raw) : {};
      state.cache = parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      state.cache = {};
    }
  }

  function saveCache() {
    try {
      var keys = Object.keys(state.cache);
      if (keys.length > CACHE_MAX) {
        var trimmed = {};
        keys.slice(keys.length - Math.floor(CACHE_MAX * 0.75)).forEach(function (k) {
          trimmed[k] = state.cache[k];
        });
        state.cache = trimmed;
      }
      localStorage.setItem(STORAGE_CACHE, JSON.stringify(state.cache));
    } catch (e) {
      /* cota cheia / modo privado: segue sem cache persistente */
    }
  }

  // ---------------------------------------------------------------- API
  function translateViaGoogle(text) {
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
      SL + "&tl=" + TL + "&dt=t&q=" + encodeURIComponent(text);

    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("google " + r.status);
      return r.text();
    }).then(function (raw) {
      var data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        throw new Error("google-parse");
      }
      if (!data || !Array.isArray(data[0])) throw new Error("google-shape");
      return data[0].map(function (seg) {
        return seg && seg[0] ? seg[0] : "";
      }).join("").trim();
    });
  }

  function google(text) {
    if (state.googleOff) return Promise.reject(new Error("google-off"));
    return translateViaGoogle(text).then(function (zh) {
      state.googleFails = 0;
      return zh;
    }, function (err) {
      state.googleFails += 1;
      if (state.googleFails >= 3) state.googleOff = true;
      throw err;
    });
  }

  function translateViaMyMemory(text) {
    if (state.quotaHit) return Promise.reject(new Error("mymemory-quota"));
    if (text.length > MYMEMORY_MAX) return Promise.reject(new Error("mymemory-too-long"));

    var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) +
      "&langpair=" + encodeURIComponent(SL + "|" + TL) + "&mt=1";

    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("mymemory " + r.status);
      return r.json();
    }).then(function (data) {
      var status = data && data.responseStatus;
      var t = data && data.responseData && data.responseData.translatedText;

      if (status === 429 || (data && data.quotaFinished) ||
        (typeof t === "string" && /USED ALL|DAILY LIMIT|MYMEMORY WARNING/i.test(t))) {
        state.quotaHit = true;
        throw new Error("mymemory-quota");
      }
      if (typeof t === "string" && /QUERY LENGTH LIMIT/i.test(t)) {
        throw new Error("mymemory-too-long");
      }
      if (!t) throw new Error("mymemory-shape");
      return String(t).trim();
    });
  }

  function translateOne(text) {
    var key = (text || "").trim();
    if (!key) return Promise.resolve(null);
    if (GLOSSARY[key]) return Promise.resolve(GLOSSARY[key]);
    if (state.cache[key]) return Promise.resolve(state.cache[key]);
    if (key.length > MAX_LEN) return Promise.resolve(null);

    return google(key)
      .catch(function () { return translateViaMyMemory(key); })
      .then(function (zh) {
        zh = (zh || "").trim();
        if (zh && zh.toLowerCase() !== key.toLowerCase()) {
          state.cache[key] = zh;
          return zh;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  function runPool(items, worker, concurrency) {
    return new Promise(function (resolve) {
      if (!items.length) { resolve([]); return; }
      var idx = 0;
      var active = 0;
      var out = [];

      function pump() {
        if (idx >= items.length && active === 0) {
          resolve(out);
          return;
        }
        while (active < concurrency && idx < items.length) {
          (function (myIdx) {
            active += 1;
            worker(items[myIdx]).then(function (res) {
              out[myIdx] = res;
            }, function () {
              out[myIdx] = null;
            }).then(function () {
              active -= 1;
              pump();
            });
          })(idx);
          idx += 1;
        }
      }

      pump();
    });
  }

  function translateMany(strings) {
    var seen = {};
    var unique = [];
    strings.forEach(function (s) {
      var k = (s || "").trim();
      if (k && !seen[k]) {
        seen[k] = 1;
        unique.push(k);
      }
    });

    return runPool(unique, translateOne, CONCURRENCY).then(function (arr) {
      var map = {};
      var need = 0;
      var miss = 0;
      unique.forEach(function (k, i) {
        map[k] = arr[i];
        if (!GLOSSARY[k]) {
          need += 1;
          if (!arr[i]) miss += 1;
        }
      });
      state.lastMissRatio = need ? miss / need : 0;
      saveCache();
      return map;
    });
  }

  // ---------------------------------------------------------------- DOM scan
  function elementSkipped(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP_TAGS[el.tagName]) return true;
    if (el.classList && el.classList.contains("i18n-pair")) return true;
    if (el.hasAttribute && el.hasAttribute("data-no-i18n")) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function hasLetter(text) {
    try {
      return /\p{L}/u.test(text);
    } catch (e) {
      return /[a-zA-ZÀ-ɏ]/.test(text);
    }
  }

  // true => não traduzir (número, símbolo, código de base, sigla curta)
  function shouldSkipText(raw) {
    var t = (raw || "").trim();
    if (!t) return true;
    if (t.length > MAX_LEN) return true;
    if (!hasLetter(t)) return true;
    // siglas / ícones curtos: RL, DB, SLA, AC, IN, AG, SP, OK
    if (t.length <= 3 && t === t.toUpperCase() && !/[a-zà-ÿ]/.test(t) && !/\d/.test(t)) return true;
    // códigos de base: "F ITQ-SP", "GRU 03-SP", "VCP 05-SP"
    if (t.length < 22 && t === t.toUpperCase() && /[A-Z]/.test(t) && /[-\d]/.test(t)) return true;
    return false;
  }

  function nodeInsideSkipped(node) {
    var p = node.parentNode;
    while (p && p !== document.documentElement) {
      if (elementSkipped(p)) return true;
      p = p.parentNode;
    }
    return false;
  }

  function textNodeAllowed(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return false;
    if (shouldSkipText(node.nodeValue)) return false;
    var p = node.parentNode;
    // <option>/<optgroup> já convertidos não devem ser reprocessados
    if (p && (p.tagName === "OPTION" || p.tagName === "OPTGROUP") && p.dataset.i18nPt != null) {
      return false;
    }
    return !nodeInsideSkipped(node);
  }

  function hostElement(root) {
    var host = root;
    if (!host) return document.body;
    if (host.nodeType === 3) host = host.parentNode;
    if (!host || host.nodeType !== 1) return document.body;
    return host;
  }

  function collectTextNodes(root) {
    var host = hostElement(root);
    var nodes = [];
    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return textNodeAllowed(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function collectAttrTargets(root) {
    var host = hostElement(root);
    var out = [];
    var list = host.querySelectorAll("[placeholder], [title]");

    Array.prototype.forEach.call(list, function (el) {
      if (elementSkipped(el) || nodeInsideSkipped(el)) return;
      ["placeholder", "title"].forEach(function (attr) {
        var v = el.getAttribute(attr);
        var flag = "i18nOrig" + attr;
        if (v && v.trim() && !shouldSkipText(v) && el.dataset[flag] == null) {
          out.push({ el: el, attr: attr, flag: flag, text: v });
        }
      });
    });
    return out;
  }

  // ---------------------------------------------------------------- apply
  function makePair(zh, pt) {
    var ruby = document.createElement("ruby");
    ruby.className = "i18n-pair";
    ruby.setAttribute("data-no-i18n", "");
    ruby.setAttribute("lang", TL);
    ruby.dataset.i18nPt = pt;
    ruby.appendChild(document.createTextNode(zh));

    var rt = document.createElement("rt");
    rt.className = "i18n-pt";
    rt.setAttribute("lang", "pt-BR");
    rt.textContent = pt.trim();
    ruby.appendChild(rt);
    return ruby;
  }

  function applyToTextNode(node, zh) {
    if (!node.parentNode) return;
    var original = node.nodeValue;
    var pt = original.trim();
    if (!zh || zh === pt) return;

    var parent = node.parentNode;

    // <option> não aceita elementos: usa texto bilíngue simples
    if (parent.tagName === "OPTION" || parent.tagName === "OPTGROUP") {
      if (parent.dataset.i18nPt == null) parent.dataset.i18nPt = parent.textContent;
      parent.textContent = zh + "  ·  " + pt;
      return;
    }

    var lead = (original.match(/^\s*/) || [""])[0];
    var trail = (original.match(/\s*$/) || [""])[0];

    var frag = document.createDocumentFragment();
    if (lead) frag.appendChild(document.createTextNode(lead));
    frag.appendChild(makePair(zh, pt));
    if (trail) frag.appendChild(document.createTextNode(trail));

    parent.replaceChild(frag, node);
  }

  function topLevelRoots(list) {
    var uniq = list.filter(function (el, i, arr) {
      return el && el.nodeType === 1 && el.isConnected && arr.indexOf(el) === i;
    });
    return uniq.filter(function (el) {
      return !uniq.some(function (other) { return other !== el && other.contains(el); });
    });
  }

  function translateRoots(roots, quiet) {
    var list = topLevelRoots(roots);
    if (!list.length) return Promise.resolve();

    var textNodes = [];
    var attrTargets = [];
    list.forEach(function (root) {
      collectTextNodes(root).forEach(function (n) { textNodes.push(n); });
      collectAttrTargets(root).forEach(function (a) { attrTargets.push(a); });
    });

    var strings = textNodes.map(function (n) { return n.nodeValue; })
      .concat(attrTargets.map(function (a) { return a.text; }));

    var includesTitle = list.indexOf(document.body) !== -1;
    if (includesTitle && document.title) strings.push(document.title);

    if (!strings.length) return Promise.resolve();

    if (!quiet) {
      state.busy = true;
      renderButton();
    }

    return translateMany(strings).then(function (map) {
      pauseObserver();

      textNodes.forEach(function (node) {
        var zh = map[(node.nodeValue || "").trim()];
        if (zh) applyToTextNode(node, zh);
      });

      attrTargets.forEach(function (t) {
        var zh = map[t.text.trim()];
        if (!zh) return;
        t.el.dataset[t.flag] = t.text;
        t.el.setAttribute(t.attr, zh);
      });

      if (includesTitle && document.title) {
        var zhTitle = map[document.title.trim()];
        if (zhTitle) {
          if (state.titleOriginal == null) state.titleOriginal = document.title;
          document.title = zhTitle;
        }
      }

      resumeObserver();
    }).then(function () {
      if (!quiet) {
        state.busy = false;
        renderButton();
      }
    });
  }

  // ---------------------------------------------------------------- restore
  function restore() {
    pauseObserver();

    Array.prototype.forEach.call(document.querySelectorAll("ruby.i18n-pair"), function (ruby) {
      var parent = ruby.parentNode;
      if (!parent) return;
      var pt = ruby.dataset.i18nPt != null
        ? ruby.dataset.i18nPt
        : (ruby.firstChild ? ruby.firstChild.nodeValue : "");
      parent.replaceChild(document.createTextNode(pt), ruby);
      parent.normalize();
    });

    Array.prototype.forEach.call(document.querySelectorAll("option[data-i18n-pt], optgroup[data-i18n-pt]"), function (el) {
      el.textContent = el.dataset.i18nPt;
      delete el.dataset.i18nPt;
    });

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-i18n-origplaceholder], [data-i18n-origtitle]"),
      function (el) {
        if (el.dataset.i18nOrigplaceholder != null) {
          el.setAttribute("placeholder", el.dataset.i18nOrigplaceholder);
          delete el.dataset.i18nOrigplaceholder;
        }
        if (el.dataset.i18nOrigtitle != null) {
          el.setAttribute("title", el.dataset.i18nOrigtitle);
          delete el.dataset.i18nOrigtitle;
        }
      }
    );

    if (state.titleOriginal != null) {
      document.title = state.titleOriginal;
      state.titleOriginal = null;
    }

    resumeObserver();
  }

  // ---------------------------------------------------------------- observer
  function handleMutations(mutations) {
    mutations.forEach(function (m) {
      if (m.type !== "childList") return;
      Array.prototype.forEach.call(m.addedNodes, function (nd) {
        if (nd.nodeType === 1 && !elementSkipped(nd)) state.pendingRoots.push(nd);
        else if (nd.nodeType === 3 && nd.parentNode) state.pendingRoots.push(nd.parentNode);
      });
    });
    if (!state.pendingRoots.length) return;

    clearTimeout(state.debounce);
    state.debounce = setTimeout(flushPending, 450);
  }

  function flushPending() {
    var roots = state.pendingRoots;
    state.pendingRoots = [];
    if (state.active && roots.length) translateRoots(roots, true);
  }

  function startObserver() {
    if (!state.observer) state.observer = new MutationObserver(handleMutations);
    state.observerDepth = 0;
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (state.observer) state.observer.disconnect();
    state.observerDepth = 0;
    state.pendingRoots = [];
    clearTimeout(state.debounce);
  }

  function pauseObserver() {
    if (!state.observer) return;
    state.observerDepth += 1;
    if (state.observerDepth === 1) state.observer.disconnect();
  }

  function resumeObserver() {
    if (!state.observer || !state.active) return;
    state.observerDepth -= 1;
    if (state.observerDepth <= 0) {
      state.observerDepth = 0;
      // descarta o que a própria aplicação gerou antes de religar
      state.observer.takeRecords();
      state.observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ---------------------------------------------------------------- button
  function renderButton() {
    if (!state.button) return;
    state.button.classList.toggle("is-active", state.active);
    state.button.classList.toggle("is-busy", state.busy);
    state.button.disabled = state.busy;
    state.button.setAttribute("aria-pressed", state.active ? "true" : "false");
    state.button.setAttribute("aria-busy", state.busy ? "true" : "false");
    state.button.textContent = state.busy
      ? BTN_LABEL_BUSY
      : (state.active ? BTN_LABEL_ON : BTN_LABEL);
    state.button.setAttribute(
      "title",
      state.active ? "Tradução híbrida ativa — clique para voltar ao português" : BTN_LABEL
    );
  }

  function didTranslateAnything() {
    return !!document.querySelector(
      "ruby.i18n-pair, option[data-i18n-pt], [data-i18n-origplaceholder], [data-i18n-origtitle]"
    ) || state.titleOriginal != null;
  }

  function afterActivation() {
    if (state.busy) {
      state.busy = false;
      renderButton();
    }
    if (!state.active) return;

    if (!didTranslateAnything()) {
      state.active = false;
      persistActive(false);
      renderButton();
      notify(state.quotaHit
        ? "Cota de tradução esgotada por enquanto. Tente mais tarde — o que já foi traduzido fica salvo."
        : "Não foi possível traduzir agora (sem internet ou serviço indisponível).");
      return;
    }

    if (state.quotaHit) {
      notify("Tradução parcial: o limite do serviço foi atingido. O restante fica em português.");
    } else if (state.lastMissRatio >= 0.3) {
      notify("Tradução incompleta: parte do texto continuou em português (rede instável). Reative para tentar de novo.");
    }
  }

  function persistActive(value) {
    try { localStorage.setItem(STORAGE_ACTIVE, value ? "1" : "0"); } catch (e) {}
  }

  function activate() {
    state.active = true;
    state.busy = true;
    persistActive(true);
    startObserver();
    renderButton();
    return translateRoots([document.body], false).then(afterActivation);
  }

  function deactivate() {
    state.active = false;
    persistActive(false);
    stopObserver();
    restore();
    renderButton();
  }

  function toggle() {
    if (state.busy) return;
    if (state.active) deactivate();
    else activate();
  }

  // ---------------------------------------------------------------- toast
  function notify(msg) {
    var box = document.getElementById("appMessage") || document.getElementById("agMessage");
    if (box) {
      box.className = "message-box is-warning";
      box.textContent = msg;
      return;
    }
    var toast = document.createElement("div");
    toast.className = "i18n-toast";
    toast.setAttribute("data-no-i18n", "");
    toast.setAttribute("role", "status");
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    setTimeout(function () {
      toast.classList.remove("is-visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 320);
    }, 4600);
  }

  // ---------------------------------------------------------------- boot
  function mountButton() {
    if (document.getElementById("hybridZhBtn")) {
      state.button = document.getElementById("hybridZhBtn");
      return;
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "hybridZhBtn";
    btn.className = "btn-secondary i18n-hybrid-btn";
    btn.setAttribute("data-no-i18n", "");
    btn.setAttribute("aria-label", "Alternar tradução híbrida em chinês simplificado");
    btn.addEventListener("click", toggle);

    var host = document.querySelector(".topbar-right") ||
      document.querySelector(".topbar") ||
      document.body;
    host.insertBefore(btn, host.firstChild);
    state.button = btn;
  }

  function init() {
    if (!document.body) return;
    loadCache();
    mountButton();

    var wasActive = false;
    try { wasActive = localStorage.getItem(STORAGE_ACTIVE) === "1"; } catch (e) {}

    if (wasActive) {
      activate();
    } else {
      renderButton();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.CTI18n = {
    toggle: toggle,
    activate: activate,
    deactivate: deactivate,
    isActive: function () { return state.active; },
    addTerms: function (obj) {
      if (obj && typeof obj === "object") {
        Object.keys(obj).forEach(function (k) { GLOSSARY[k] = obj[k]; });
      }
    },
    clearCache: function () {
      state.cache = {};
      try { localStorage.removeItem(STORAGE_CACHE); } catch (e) {}
    }
  };
})();
