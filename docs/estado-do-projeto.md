# Estado do projeto

## Incremento 3 — OAuth sem API key (08/11/2026)

- Pedido confirmado: IDE gratuita e open source, com autenticação ChatGPT sem copiar chaves/tokens. Licença MIT adicionada. O processo principal não usa `OPENAI_API_KEY` para o agente ChatGPT; não existe fallback para cobrança de API. Codex continua independente, com configuração própria do CLI.
- OAuth revisado contra a documentação oficial e o devkit: descoberta OIDC com validação de origem, PKCE, state, nonce, assinatura RS256 e claims obrigatórias, client ID por registro e host ID persistente. Callback loopback rejeita state incorreto sem consumir a tentativa. Tokens ficam criptografados via SafeStorage, fora do Git. Renovação serializada aceita ausência de ID token no refresh e preserva rotação pendente em disco; desconexão tenta revogar a sessão e informa quando não há confirmação remota. Parar cancela a espera do login.
- Corrigida concorrência na autorização inicial Codex e preservada sua sessão ao trocar apenas o modelo ChatGPT. Instância única do Electron evita concorrência de credenciais/cache.
- Verificação: `npm test`, **15/15 aprovados**; sintaxe dos arquivos alterados verificada. Teste do Electron com perfil temporário: janela e preload carregados, seletor alternou ChatGPT/Codex, envio sem autenticação foi recusado e PowerShell executou `Write-Output CHATAGENTE_OK` com sucesso. `npm install --package-lock-only --ignore-scripts` concluiu com auditoria de 0 vulnerabilidades reportadas.
- O teste OAuth usa provedor e tokens simulados, assinatura criptográfica verificada e callback HTTP local real. Cobre PKCE, state inválido, catálogo, renovação concorrente e revogação. **Login de conta real e inferência real permanecem não verificados**. Nenhuma franquia ou API paga foi consumida pelos testes.
- Gratuidade do software não garante gratuidade dos modelos: elegibilidade, assinatura, franquia e créditos seguem a conta OpenAI. A interface inclui link para gerenciar uso. Não promete acesso com conta Free nem contorna limites. MVP mantém uma conexão ChatGPT por instalação; não oferece seletor de múltiplas contas/workspaces. Implementação não equivale a certificação de conformidade integral.

Fontes consultadas: https://developers.openai.com/siwc/token-sharing-open-source, https://developers.openai.com/siwc/token-sharing-open-source/sign-in, https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference, https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions, https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations. Os registros anteriores abaixo são históricos; o incremento 3 substitui a alternativa de API key do aplicativo.

## Incremento 2 — seleção ChatGPT / Codex (08/11/2026)

- A barra lateral agora oferece escolha real entre **ChatGPT** (agente próprio com funções locais) e **Codex** (SDK oficial com sessão da instalação local).
- ChatGPT pode usar o fluxo oficial **Sign in with ChatGPT** para aplicativos locais de código aberto: OAuth/OIDC com PKCE, callback HTTP loopback, verificação de assinatura/issuer/audience/nonce, token de plano ChatGPT, refresh e armazenamento criptografado com Electron SafeStorage. Também mantém alternativa de chave de API independente (`.env`).
- O seletor exibe modelos devolvidos pela conta conectada e usa seu identificador nas requisições. A chamada com plano usa `store: false`, `stream: true` e ferramentas locais agrupadas em namespace; o ciclo de autorização de escrita/PowerShell é mantido.
- No modo Codex, uma caixa de diálogo por tarefa explica o acesso `workspace-write` e permite continuar ou cancelar antes da execução. Atividades e texto do SDK aparecem na interface; cancelamento e reinício de conversa usam thread independente.
- Login Codex CLI verificado via `codex login status` (`Logged in using ChatGPT`). `npm test`: **12/12** aprovados; testes novos validam a criptografia no armazenamento local, persistência do identificador do host, troca/streaming de eventos Codex simulados e inicialização sem API key. `npm run dev`: janela Electron aberta e respondendo em Windows. Registros de cache do Electron tiveram erros de acesso porque outra instância do mesmo aplicativo já estava aberta.
- **Pendente de verificação com consentimento do titular:** completar o login ChatGPT no navegador, obter lista de modelos, uma inferência real com ferramentas e uma inferência real no Codex SDK. Nenhuma chamada de inferência paga ou consumo de plano foi feita durante este incremento.
- Limites: uma conexão ChatGPT por instalação neste MVP; revogação remota do acesso é feita pelo usuário nas configurações do ChatGPT. O histórico continua em memória. Não implementa acesso às conversas do app ChatGPT.

Referências oficiais consultadas em 08/11/2026: https://developers.openai.com/siwc/token-sharing-open-source, https://developers.openai.com/siwc/token-sharing-open-source/sign-in, https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations, https://developers.openai.com/codex/sdk.

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
