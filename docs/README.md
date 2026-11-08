# IDE Windows com agente de IA

Documentação e visão evolutiva do ChatAgente. Criada em 08/11/2026 a partir do pedido do usuário. O núcleo funcional já existe em `src/`; veja o `README.md` da raiz para instalar e usar o aplicativo.

## Como usar

Os documentos de especificação estão reunidos em `docs/`. Para retomar trabalho, abra `C:\Dev\agenteChat`, leia `docs/INICIAR.md` e o estado registrado em `docs/estado-do-projeto.md`. Existe um `AGENTS.md` na raiz que aponta para estas instruções.

## Ordem de leitura

1. [Instruções do agente](AGENTS.md).
2. [Requisitos e regras](regras-de-negocio.md).
3. [Arquitetura proposta](arquitetura.md).
4. [Plano e critérios de aceitação](plano-e-aceitacao.md).
5. [Estado e pendências](estado-do-projeto.md).

O pedido original confirma um aplicativo Windows com chat e amplo acesso local, arquivos, Git e navegador. A divisão em etapas e as políticas detalhadas permanecem propostas, não aprovações atribuídas ao usuário. A primeira implementação usa Electron + Node.js e o SDK oficial OpenAI; links consultados constam no `README.md` da raiz. Navegador e controle geral do Windows continuam no planejamento.
