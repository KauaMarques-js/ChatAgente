# Estado do projeto

Atualizado em 08/11/2026.

## Objetivo e autorização

Construir uma IDE Windows com chat OpenAI e ferramentas locais. O usuário solicitou, em 08/11/2026, **começar pela versão mais simples funcional**, com terminal PowerShell integrado, scripts `npm run dev` e publicação no repositório `KauaMarques-js/ChatAgente`. A implementação inicial em Electron + Node.js é uma escolha técnica reversível. As propostas P01–P06 de `regras-de-negocio.md` permanecem sem decisão final.

## Entregue no MVP

- Janela Electron com interface em português, seleção de pasta e terminal PowerShell manual.
- Integração pela API OpenAI Responses com streaming, ferramentas e `store: false`, usando chave configurável via `.env` (não versionada). Modelo padrão `gpt-5.4-mini`, configurável.
- Ciclo do agente: listar e ler arquivos texto, criar/modificar arquivos com confirmação, executar PowerShell com confirmação, consultar `git status` e `git diff`; aprovação de comandos com alerta sobre abrangência do shell.
- Proteções do executor de arquivos: validação de caminho, symlinks/junctions externos bloqueados, leitura antes da sobrescrita, detecção de conflito, limites de tamanho e exclusão de segredos óbvios.
- Cancelamento de chamada à API e tentativa de encerramento da árvore de processos; limite de tempo e saída do PowerShell; contexto de conversa temporário em memória.
- `README.md` com instalação, `.env.example` e instruções de uso.

## Evidência de verificação

- Windows, Node.js 23.11.0 e npm 11.3.0 encontrados; Electron 45.2.3 e SDK OpenAI 7.53.0 instalados por npm.
- `npm install`: executado com sucesso, auditoria de 0 vulnerabilidades reportadas na instalação.
- `npm test`: 9 testes aprovados, incluindo chamada simulada com ferramenta (sem custo API), gravação/edição Unicode, proteção contra caminhos externos, junctions e concorrência, PowerShell real, cancelamento antecipado.
- `npm run dev`: janela `ChatAgente` aberta e processo Electron respondendo no Windows. Captura da própria janela revisada (interface renderizada).
- **Não verificado:** chamada real à API OpenAI, pois `OPENAI_API_KEY` não estava configurada no ambiente. Não foi feito nenhum gasto de API.

## Limites atuais e próximos passos

Não há histórico persistido, automação de navegador, controle de outras janelas Windows, editor de código ou empacotamento `.exe`. Shell aprovado pode acessar o computador com os privilégios atuais do usuário, além da pasta do projeto. Discutir os modos e as permissões de P01/P02 antes de introduzir controle mais amplo ou automático. Conectar chave OpenAI para teste manual da tarefa ponta a ponta; depois considerar navegador, Git avançado e persistência.
