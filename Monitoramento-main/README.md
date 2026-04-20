# Monitoramento de Entregas SP — Central Operacional

Versão organizada com **menu inicial** e três módulos principais:
- Dashboard
- Insucessos
- Acompanhamento Geral

## Estrutura

```text
monitoramento-suite-menu-profissional/
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   ├── insucessos.css
│   │   └── acompanhamento-geral.css
│   ├── img/
│   └── js/
│       ├── core/
│       └── modules/
├── docs/
├── pages/
│   ├── dashboard.html
│   ├── insucessos.html
│   └── acompanhamento-geral.html
├── tools/
├── index.html
└── README.md
```

## Como navegar

- `index.html`: menu inicial do projeto.
- `pages/dashboard.html`: monitoramento principal por base.
- `pages/insucessos.html`: consolidação de insucessos.
- `pages/acompanhamento-geral.html`: leitura do arquivo executivo único.

## Como publicar no Vercel

1. Suba **todo o conteúdo da pasta** para o repositório.
2. Garanta que o `index.html` fique na raiz do projeto.
3. Faça commit e push.
4. O Vercel deve abrir primeiro o menu inicial.

## Observações

- O projeto continua usando CDN para `XLSX`, `Chart.js` e `html2canvas`.
- Para evitar problemas de navegador ao testar localmente, prefira o servidor local em `tools/`.
- As páginas internas têm botão de **Menu inicial** para retorno rápido.
