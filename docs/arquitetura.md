# Arquitetura resumida

## Entrada
- `index.html`: menu inicial da central operacional, com acesso aos 5 módulos.

## Páginas
- `pages/dashboard.html`: monitoramento por base.
- `pages/relatorios.html`: histórico de snapshots do dashboard e comparação entre períodos.
- `pages/insucessos.html`: análise de insucessos.
- `pages/acompanhamento-geral.html`: painel executivo do arquivo consolidado.
- `pages/acareacao.html`: formulário de declaração de acareação com exportação em PDF.

## Core
- `assets/js/core/config.js`: metadados, rotas de páginas, chaves de storage e dependências por módulo.
- `assets/js/core/runtime.js`: aviso de bibliotecas ausentes (checa `window.CTConfig.dependencies`).
- `assets/js/core/utils.js`: helpers comuns (DOM, formatação pt-BR, escape de HTML, `localStorage` seguro).
- `assets/js/core/main.js`: bootstrap do dashboard.
- `assets/js/core/i18n.js`: botão "Tradução híbrida em chinês simplificado" no topo de todas as páginas. Ao ativar, troca o texto fixo da interface por 中文 (linha principal) com o português menor abaixo (`<ruby>`), mantendo números e códigos de base intactos. Tradução via API pública do Google (reserva: MyMemory) + glossário curado, com cache em `localStorage` e reaplicação via `MutationObserver`. Expõe `window.CTI18n`.

## Modules
- `assets/js/modules/excel.js`: leitura e validação do Excel.
- `assets/js/modules/metrics.js`: agregações do monitoramento.
- `assets/js/modules/charts.js`: gráficos do dashboard.
- `assets/js/modules/dashboard.js`: tela principal do monitoramento.
- `assets/js/modules/history-store.js`: persistência de snapshots do dashboard em IndexedDB.
- `assets/js/modules/reports.js`: tela de Relatórios (seleção de snapshots, comparação, timeline).
- `assets/js/modules/insucessos-metrics.js`: consolidação de insucessos.
- `assets/js/modules/insucessos.js`: tela de insucessos.
- `assets/js/modules/acompanhamento-geral.js`: tela do arquivo consolidado executivo.
- `assets/js/modules/acareacao.js`: preenchimento do formulário e geração do PDF de acareação.

## Padrão de módulo
Cada arquivo em `core/` e `modules/` é uma IIFE isolada que expõe um único namespace global (`window.CTUtils`, `window.CTConfig`, `window.CTDashboard`, `window.CTReportStore`, etc.), evitando poluição do escopo global. Todo HTML dinâmico inserido via `innerHTML` passa por `CTUtils.escapeHtml` antes de ser montado.
