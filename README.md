# Monitoramento de Entregas SP — Central Operacional

Versão organizada com **menu inicial** e cinco módulos principais:
- Dashboard
- Relatórios
- Insucessos
- Acompanhamento Geral
- Acareação

## Estrutura

```text
Monitoramento-main/
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   ├── insucessos.css
│   │   └── acompanhamento-geral.css
│   ├── img/
│   └── js/
│       ├── core/
│       │   ├── config.js
│       │   ├── runtime.js
│       │   ├── utils.js
│       │   ├── i18n.js
│       │   └── main.js
│       └── modules/
│           ├── excel.js
│           ├── metrics.js
│           ├── charts.js
│           ├── dashboard.js
│           ├── history-store.js
│           ├── reports.js
│           ├── insucessos-metrics.js
│           ├── insucessos.js
│           ├── acompanhamento-geral.js
│           └── acareacao.js
├── docs/
│   └── arquitetura.md
├── pages/
│   ├── dashboard.html
│   ├── relatorios.html
│   ├── insucessos.html
│   ├── acompanhamento-geral.html
│   └── acareacao.html
├── tools/
│   ├── start-local-server.bat
│   └── start-local-server.ps1
├── index.html
└── README.md
```

## Como navegar

- `index.html`: menu inicial do projeto.
- `pages/dashboard.html`: monitoramento principal por base.
- `pages/relatorios.html`: histórico de snapshots do Dashboard, com comparação entre períodos.
- `pages/insucessos.html`: consolidação de insucessos.
- `pages/acompanhamento-geral.html`: leitura do arquivo executivo único.
- `pages/acareacao.html`: preenchimento e exportação em PDF da declaração de acareação.

## Como publicar no Vercel

1. Suba **todo o conteúdo da pasta** para o repositório.
2. Garanta que o `index.html` fique na raiz do projeto.
3. Faça commit e push.
4. O Vercel deve abrir primeiro o menu inicial.

## Tradução híbrida (中文)

- Todas as páginas têm no topo o botão **"译 Tradução híbrida em chinês simplificado"**.
- Ao clicar, o texto fixo da interface passa a aparecer em chinês simplificado com o português menor logo abaixo. Números, porcentagens e códigos de base (ex.: `F ITQ-SP`) não mudam.
- A escolha fica salva no navegador e se mantém ao navegar entre os módulos. Clique de novo para voltar ao português.
- A tradução usa a API pública do Google (reserva: MyMemory) + um glossário interno para os termos principais. Precisa de internet na primeira vez; depois fica em cache local. Se a rede/serviço falhar, o que não traduziu permanece em português.

## Observações

- O projeto continua usando CDN para `XLSX`, `Chart.js`, `html2canvas`, `jsPDF` e `Plotly` (este último só em Relatórios).
- Para evitar problemas de navegador ao testar localmente, prefira o servidor local em `tools/`.
- As páginas internas têm botão de **Menu inicial** para retorno rápido.
- O histórico de Relatórios é salvo no navegador via **IndexedDB** (`history-store.js`); os demais módulos usam `localStorage` para o estado local.
