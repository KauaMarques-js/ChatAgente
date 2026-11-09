# Estado do projeto

## Incremento 9 — chat central e tokens informados, 0.3.0 (08/11/2026)

- RF16/RF17: conversa em WebviewPanel na área principal; lateral somente com atalho. Layout amplo, Markdown seguro, código copiável, configurações recolhidas, compositor no rodapé e detalhes de ações. Abrir o chat oculta o painel inferior sem terminar os terminais. O chat abre na inicialização; uma migração única ajusta a disposição nos perfis anteriores.
- ChatGPT padrão não instancia Codex. Sem pasta, conversa com instruções curtas e nenhuma ferramenta; com projeto pode programar. Codex continua opcional/explícito. Nenhuma cota de rodadas/tempo reintroduzida. P01–P06 permanecem propostas.
- `src/usage.cjs` normaliza metadados Responses/Codex e agrega entrada, saída, total, cache e raciocínio. UI separa resposta atual e conversa; ausência/invalidez nunca vira zero, faltas tornam o agregado parcial. Cache/raciocínio não são somados novamente ao total. Uso disponível é preservado nas falhas/incompletude. Não faz chamadas extras para contar nem calcula saldo/cobrança.
- Verificação: **46/46 testes locais aprovados**, cobrindo conversa sem pasta, ChatGPT sem Codex, painel central único/reabertura, agregação/reset, uso ausente/parcial, falha/incompletude e uso Codex. Teste na IDE real percorreu runtime/bridge com resposta e contagem simulados e confirmou o chat e o contador, além de editor/Git/PowerShell persistente/Ctrl+C. Captura `out/ide-native.png` revisada. Login/inferência reais continuam não verificados por teste controlado.
- Limites: contador depende de metadados do provedor e não garante uso gratuito/menor que Codex. A captura adicional mencionada pelo usuário ainda não foi recebida; o layout segue a referência verbal.
- Publicada para teste: https://github.com/KauaMarques-js/ChatAgente/releases/tag/v0.3.0, fonte no commit `90688a2`. Corrigido cache de empacotamento para recriar artefatos da versão atual. ZIP, instalador e conteúdo interno do instalador passaram na integridade; runtime/bridge/mídia extraídos dos dois downloads conferem com os fontes testados. Links públicos retornaram HTTP 200 com tamanhos e SHA-256 conferidos: instalador 312.480.856 bytes, `58b8feb2884047e9c83a534a22952842b8ff03247d936cec5d1043b3b7c7b3e0`; ZIP 406.158.762 bytes, `044d091a98a284f9cdf9b65bd96017ebb5296720fe1bd8336de8fa8d37fb49c6`. Abertura normal também verificada sem flags de desenvolvimento. Instalação completa em máquina limpa ainda não validada.

Fontes consultadas em 08/11/2026: https://code.visualstudio.com/api/extension-guides/webview, https://developers.openai.com/api/docs/guides/token-counting e https://developers.openai.com/api/docs/guides/agents-api/observability. Campos Responses/Codex também conferidos nos tipos dos SDKs instalados.

## Incremento 8 — IDE independente Code OSS, 0.2.0 (08/11/2026)

- RF14/RF15 confirmados: manter aplicativo separado e buscar o fluxo de programação do VS Code, com seleção ChatGPT/Codex. Removidas cotas locais de rodadas, prazo total, pausa por repetição e timeout de 30 segundos dos comandos do agente. A execução continua cancelável. Limites do provedor e do contexto não podem ser convertidos em uso ilimitado pelo aplicativo.
- Base da distribuição alterada para Code OSS/VSCodium 1.143.17232, fixada em `ide-base.json` com SHA-256 oficial. Recursos nativos: explorador, edição/salvamento/abas, terminal PowerShell persistente, Git, busca, extensões e depuração. Loja Open VSX, licenças e avisos de terceiros preservados; nenhuma promessa de serviços proprietários Microsoft. Identidade ChatAgente e perfis próprios; não depende do VS Code instalado.
- Integração em `ide-extension/`: painel e status bar com escolha dos dois agentes/modelos, login ChatGPT OAuth, login Codex no terminal, streaming, aprovações, Parar e conversa em memória. Codex herda perfil/configuração locais normais. SecretStorage guarda a chave AES-GCM; named pipe coordena inicialização/refresh/logout entre janelas. Nenhuma credencial pessoal entra na distribuição.
- `npm run dev` prepara/abre a IDE nativa; `prepare:ide` baixa/verifica a base e copia os módulos de `src/` e dependências de produção; `dist:win` empacota a IDE pronta. Protótipo Electron preservado em `dev:legacy`. Perfis/variáveis herdadas de outro VS Code são removidos pelos lançadores de desenvolvimento/teste para evitar reutilização acidental do host.
- Verificação: `npm test`, **38/38 aprovados**. Inclui 100 rodadas sem pausa/cota, cancelamento na rodada 150, shell sem timeout local, proteção de buffers não salvos e credenciais entre janelas. `npm run test:ide` aprovado no runtime real: seleção dos dois agentes, editor/salvamento, buffer protegido, PowerShell persistente, Ctrl+C e Git nativo. Abertura normal do `ChatAgente.exe`, sem flags de desenvolvimento, confirmou ativação da integração embutida. Capturas `out/ide-native.png` e `out/ide-standalone.png` revisadas.
- Limites reais: inferência/login com conta não validados por teste controlado; não há atualização automática da distribuição nem histórico persistente do agente. Paridade de todas as capacidades da extensão proprietária Codex não foi demonstrada. Escritas via shell/Codex externo não passam pelo guard de buffers; buffers são exigidos salvos ao iniciar Codex. P01–P06 continuam propostas. ZIP deve ser extraído em pasta nova, sem sobrepor o formato do MVP antigo.
- Publicada a prévia https://github.com/KauaMarques-js/ChatAgente/releases/tag/v0.2.0, commit `73bbffa`. Instalador NSIS (312.408.523 bytes) e ZIP (406.012.665 bytes) passaram em verificação de integridade. Runtime/bridge do pacote comparados com o fonte, Open VSX/licenças e exclusão de perfis/credenciais conferidos, CLI incluído executou `codex-cli 0.167.0 --version`. Os três downloads públicos responderam HTTP 200 e digests/tamanhos conferiram; arquivo de hashes baixado e comparado. SHA-256 instalador `008f659c6f4d79e80f5d8d85487d27b58db06107423208d7db84fc591fe56d29`; ZIP `c083bae382ef1436e2111f42e0c6fda581fe2c2f6a2a178b35055aaf147ef9d4`.

Fontes consultadas em 08/11/2026: https://github.com/VSCodium/vscodium, https://code.visualstudio.com/api/extension-guides/webview, https://code.visualstudio.com/api/references/vscode-api e https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations.

## Incremento 7 — correção do limite de ferramentas, 0.1.1 (08/11/2026)

- Falha relatada ao mapear a documentação: o orçamento fixo de 14 rodadas, com chamadas paralelas desativadas, interrompia leituras sequenciais; o tratamento genérico apagava todo o histórico ao atingir o limite.
- Correção: ferramenta `read_files` para até 8 arquivos e 200 KB por lote, respeitando bloqueios e erros individuais. Orçamento técnico de 64 rodadas e 10 minutos, com reserva para resumo perto do fim do tempo. Ao esgotar rodadas ou repetir três consultas idênticas sem progresso, pede uma resposta com `tool_choice: none`, resume pendências e marca a interface como pausada. Não amplia permissões de escrita ou shell.
- Falhas/cancelamento preservam rodadas completas e descartam somente respostas incompletas. Em resposta com várias ferramentas, as não iniciadas recebem resultado de cancelamento, mantendo pares válidos; ações já feitas não são repetidas automaticamente. O usuário pode enviar “continuar”. Histórico continua apenas na memória.
- Verificação: `npm test`, **29/29 aprovados**, com regressões para 18 arquivos, limite de 64 rodadas e continuação, repetição sem progresso, leitura em lote com bloqueios/cota, falha de rede após escrita e cancelamento entre múltiplas ferramentas. Testes de inferência simulados, sem conta ou consumo real.
- Verificação no Electron com inferência simulada e ciclo real do agente: pausa por repetição, resumo, status pausado e continuação com os resultados anteriores. Corrigida também uma corrida entre a resposta IPC e os eventos: conclusão agora usa o mesmo canal ordenado dos eventos de progresso; evita resumo duplicado/status preso em “Resumindo”.
- Atualização 0.1.1 preparada para substituir o download de teste 0.1.0. P01–P06 permanecem propostas. Os limites técnicos não prometem tarefas ilimitadas nem memória persistente.
- Publicada: https://github.com/KauaMarques-js/ChatAgente/releases/tag/v0.1.1, commit `05542eb`. Executável empacotado aberto e validado novamente; arquivos do agente, processo principal, renderer e executor extraídos do ASAR e comparados com o fonte corrigido. ZIP e NSIS passaram no teste de integridade. Os três links públicos retornaram HTTP 200 e seus tamanhos/hashes conferiram. SHA-256 do instalador: `fffbcb6a819100bc1d114d5893d39be5ab69ff69e4a3c3b18e8624a244ad3397`; ZIP: `2efd5ebcb88201b28989d9183c69dbfead39d164edd9b66f226a89b0cec4130f`.

Documentação oficial consultada em 08/11/2026: https://developers.openai.com/api/docs/guides/function-calling (`tool_choice: none`, ciclo de ferramentas e resultados correspondentes).

## Incremento 6 — distribuição Windows 0.1.0 (08/11/2026)

- RF13: instalador NSIS por usuário e ZIP para Windows x64, gerados com `npm run dist:win`, Electron 45.2.3 e electron-builder 26.18.0. Pacotes em `dist/`, excluídos do Git. Configuração inclui somente código do aplicativo, documentação de uso/licença e dependências de execução; `.env`, histórico, credenciais, testes e ferramentas de publicação não entram no pacote.
- Codex SDK e seus binários ficam fora do ASAR. Na distribuição, o SDK é importado do caminho físico para localizar e executar seu CLI/recursos. Na abertura do pacote, o projeto inicial é Documentos; o usuário seleciona a pasta no explorador. Desenvolvimento mantém a pasta atual.
- Verificação: `npm test`, **23/23 aprovados**. Executável empacotado iniciado com perfil temporário: preload, explorador, troca de agentes, recusa de envio sem autenticação, PowerShell Unicode, isolamento de projeto e `codex-cli 0.167.0 --version` aprovados, sem inferência. Conteúdo do ASAR inspecionado para exclusão de arquivos locais. ZIP e instalador NSIS passaram na verificação de integridade do 7-Zip. `npm audit --omit=dev`: 0 vulnerabilidades reportadas; dependências de empacotamento reportam 6 moderadas no desenvolvimento.
- Artefatos gerados: `ChatAgente-Setup-0.1.0-x64.exe` (248.844.055 bytes) e `ChatAgente-0.1.0-win.zip` (324.923.018 bytes), acompanhados de hashes SHA-256 para publicação na prévia `v0.1.0` do GitHub Releases.
- Publicado: https://github.com/KauaMarques-js/ChatAgente/releases/tag/v0.1.0, prévia vinculada ao commit `1e9fbde`. Os três downloads públicos responderam HTTP 200; tamanhos e digests SHA-256 dos binários conferem com os arquivos locais. `SHA256SUMS.txt` baixado e comparado integralmente. Instalador: `603c5791061887dd9165f0b303d27c494d15b901cf9d7df2ef3ed4a054ad1dab`; ZIP: `91366e7b347562d68e0964f752c7793abf076329dd7c1a28cf656f10b26c3edc`.
- Limites: sem assinatura digital ou atualização automática; instalação completa em máquina limpa não verificada. Abertura testada no Windows 10 x64. Login ChatGPT e inferência real continuam não verificados. Nenhuma credencial pessoal ou franquia de inferência usada na validação. README e notas de versão explicam instalação, requisitos e limites da prévia.

Fontes consultadas em 08/11/2026: https://www.electron.build/configuration/, https://www.electron.build/nsis/ e https://www.electron.build/win/.

## Incremento 5 — explorador de projeto (08/11/2026)

- Pedido RF12: lateral com raiz do projeto, hierarquia de pastas, expansão/recolhimento, ícones por extensão, seleção e indicadores reais do Git. Diretórios são listados sob demanda, inclusive `node_modules`; `.git` fica oculto. Git usa registros separados por NUL e normaliza caminhos para projetos dentro de repositórios, incluindo renomeações e Unicode.
- Arquivos abrem uma prévia de texto somente leitura na área central; fechar retorna ao chat. Configurações e login continuam disponíveis em “Agente e ferramentas”, no rodapé da lateral. Atualização manual e após tarefas/comandos preserva as pastas abertas. Trocar projeto descarta árvore e prévia anteriores; respostas antigas não substituem o projeto atual.
- IPC valida o projeto e caminhos no processo principal. Prévia mantém os bloqueios existentes de arquivos sensíveis, links externos, binários e textos acima de 100 KB, e não registra a leitura como autorização para futura escrita pelo agente. Nenhum conteúdo é enviado à OpenAI ao explorar ou visualizar arquivos.
- Verificação: `npm test`, **23/23 aprovados**, incluindo diretórios sob demanda, dependências, limites de acesso, prévia sem habilitar escrita e status Git real com renomeação e projeto em subpasta. No Electron com perfil temporário e seleção de pasta controlada para teste: expansão, Git `M`, prévia, HTML mostrado como texto, segredo bloqueado, atualização, recolhimento e troca de projeto. Captura da janela revisada. Nenhuma inferência ou login externo.
- Limites: não inclui edição, criação, exclusão, drag-and-drop ou monitoramento contínuo de mudanças externas; usar atualizar e reabrir a prévia para recarregar o arquivo. P01–P06 permanecem propostas. Próximo incremento possível: editor com salvamento e detecção de conflito.

Fontes técnicas consultadas em 08/11/2026: https://nodejs.org/api/fs.html (`readdir`/`Dirent`) e https://git-scm.com/docs/git-status (formato porcelain e registros NUL).

## Incremento 4 — atalhos e saída do PowerShell (08/11/2026)

- Pedido RF11: terminal no painel inferior, `Ctrl + '` abre/oculta e leva o foco ao campo de comando; ao ocultar, devolve o foco quando necessário. Ocultar mantém o comando ativo. `Ctrl + C` dentro do terminal tenta encerrar a árvore de processos, preservando a cópia quando há seleção. Interrupção manual tem IPC próprio e não cancela tarefas do agente.
- Saída de stdout/stderr transmitida em tempo real, decodificação UTF-8 entre blocos, últimas 25 mil posições preservadas na interface e resultado agregado limitado como antes. Comandos manuais podem continuar além de 30 segundos; ferramentas do agente mantêm seu timeout. Histórico de até 100 comandos por execução do aplicativo, setas ↑/↓ e botões para interromper, limpar e ocultar.
- Verificação automatizada: `npm test`, **19/19 aprovados**, incluindo PowerShell real com streaming e interrupção, encerramento de processo filho no Windows, UTF-8 dividido entre blocos e avisos/erros legíveis sem CLIXML. Sintaxe dos arquivos JavaScript alterados verificada e `git diff --check` sem erros.
- Verificação no Electron com perfil temporário e comandos locais reais: abrir/ocultar por teclado, foco, histórico, saída antes do término, cópia com seleção, ocultar sem interromper, comando ativo por mais de 30 segundos, `Ctrl + C` e novo comando após interrupção. Captura da janela revisada; a saída agora usa texto em vez da serialização XML de `-EncodedCommand`. Sem login ou chamadas de inferência.
- Limites: cada envio inicia um novo PowerShell na pasta do projeto, sem persistir `cd`/variáveis e sem entrada interativa. O bloqueio existente entre comando manual e tarefa do agente permanece. Não há nova dependência ou mudança nas propostas P01–P06. Próximo passo possível: sessão persistente com suporte a programas interativos.

Fontes técnicas consultadas em 08/11/2026: https://nodejs.org/api/child_process.html (`spawn`, stdout/stderr e encerramento de processos) e https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1 (argumentos e formato de saída do PowerShell).

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

O incremento 8 adiciona editor com salvamento e terminal/recursos nativos da IDE. Conversa persistente do agente, automação de navegador e controle geral do Windows ainda não foram entregues/verificados. Shell aprovado pode acessar o computador com os privilégios atuais do usuário, além da pasta do projeto. Preservar P01/P02 como propostas ao introduzir novos modos de acesso. Validar a jornada real de programação/autenticação dos dois agentes com uma conta, depois avançar nas integrações pendentes.
