# Arquitetura resumida

## Entrada
- `index.html`: menu inicial da central operacional.

## Páginas
- `pages/dashboard.html`: monitoramento por base.
- `pages/insucessos.html`: análise de insucessos.
- `pages/acompanhamento-geral.html`: painel executivo do arquivo consolidado.

## Core
- `assets/js/core/config.js`: metadados e dependências.
- `assets/js/core/runtime.js`: aviso de bibliotecas ausentes.
- `assets/js/core/utils.js`: helpers comuns.
- `assets/js/core/main.js`: bootstrap do dashboard.

## Modules
- `assets/js/modules/excel.js`: leitura e validação do Excel.
- `assets/js/modules/metrics.js`: agregações do monitoramento.
- `assets/js/modules/charts.js`: gráficos do dashboard.
- `assets/js/modules/dashboard.js`: tela principal do monitoramento.
- `assets/js/modules/insucessos-metrics.js`: consolidação de insucessos.
- `assets/js/modules/insucessos.js`: tela de insucessos.
- `assets/js/modules/acompanhamento-geral.js`: tela do arquivo consolidado executivo.
