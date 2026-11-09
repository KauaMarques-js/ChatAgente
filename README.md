# ChatAgente

Aplicativo independente para Windows x64 com **chat central usando ChatGPT por padrão**, para conversar, tirar dúvidas e programar. Conversas simples funcionam sem abrir uma pasta; com projeto aberto, as ferramentas permitem trabalhar nos arquivos. A base **Code OSS/VSCodium** fornece editor, explorador, terminal persistente e Git. Codex permanece uma escolha explícita e separada.

## Baixar

[Versão 0.3.0](https://github.com/KauaMarques-js/ChatAgente/releases/tag/v0.3.0):

- **ChatAgente-Setup-0.3.0-x64.exe**: feche o aplicativo anterior e execute o instalador.
- **ChatAgente-0.3.0-win.zip**: extraia inteiro em uma **pasta nova e vazia** e abra `ChatAgente.exe`. Não extraia sobre o antigo MVP Electron, que usa outro formato de recursos.
- **SHA256SUMS.txt**: hashes para conferir os downloads.

Não precisa instalar VS Code, Node.js ou npm para abrir a distribuição. PowerShell executa o terminal local; Git é necessário para os recursos Git. Pacotes sem assinatura digital; o Windows pode exibir aviso. Abertura e recursos principais verificados no Windows 10 x64; instalação completa em máquina limpa não verificada.

## Usar

1. Abra **ChatAgente** pela paleta (`Ctrl+Shift+P` → `ChatAgente: Abrir chat`) ou pelo atalho na lateral. A conversa abre na **área principal**, com compositor no rodapé e configurações recolhidas. Abrir o chat oculta o painel inferior, sem encerrar os terminais.
2. Em **Configurações e login**, conecte o ChatGPT e selecione um modelo disponível. Você pode conversar sem pasta; para trabalhar em arquivos, abra um projeto e confirme a confiança da IDE.
3. ChatGPT é o padrão e usa integração direta, sem iniciar Codex. Codex pode ser escolhido explicitamente nas configurações ou barra de status. A troca exige a tarefa atual finalizada/interrompida.
4. Descreva a tarefa. Enter envia; Shift+Enter quebra linha. Use **Interromper** para cancelar.

O explorador/editor funciona com arquivos reais, salvamento, abas e diferenças nativas. **Ctrl+'** abre/oculta o terminal; **Ctrl+C** interrompe o programa no terminal e preserva a cópia quando há seleção, conforme o comportamento da IDE. O PowerShell mantém diretório e variáveis entre comandos. Você pode trabalhar no editor e no terminal durante a execução do agente.

**ChatGPT:** clique em **Entrar com ChatGPT**, conclua o OAuth no navegador e selecione um modelo da conexão. Não exige API key nem usa fallback de cobrança por chave. A nova IDE mantém credenciais em seu próprio perfil; o login do MVP anterior não é copiado automaticamente.

**Codex:** usa o SDK/CLI oficial incluído, com o login/configuração locais normais do Codex, incluindo `CODEX_HOME` quando configurado. Se já usa Codex no VS Code, o perfil local continua sendo o padrão. **Entrar com Codex** abre `codex login` no terminal nativo. O campo de modelo vazio usa o padrão configurado no CLI.

## Execução sem cotas locais

O ChatAgente não impõe número máximo de rodadas de ferramentas, prazo total de tarefa, pausa automática por repetição nem obrigação de enviar “continuar”. Comandos aprovados do agente também não recebem o antigo timeout de 30 segundos. A execução segue até a resposta final do agente, um impedimento real, falha do serviço ou interrupção pelo usuário.

Isso não elimina limites de plano, contexto, disponibilidade ou uso da OpenAI. O software é gratuito/open source; inferência e elegibilidade seguem a conta. Referências: [uso e planos Codex](https://learn.chatgpt.com/docs/pricing) e [limites da integração ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

Resultados completos de ferramentas são preservados na memória após falhas, sem repetir automaticamente operações já feitas. Fechar/reiniciar ou trocar de projeto descarta esse contexto. Leituras e saídas individuais continuam delimitadas para o contexto do modelo; isso não limita quantas rodadas a tarefa pode executar.

## Contagem de tokens

O rodapé mostra **Tokens desta resposta**, com entrada, saída, total e detalhamento da conversa. Os números vêm dos metadados `usage` do serviço, sem chamadas extras para estimar. Em tarefas com ferramentas, soma todas as requisições da resposta atual. Cache e raciocínio já estão incluídos no total e não são somados novamente.

Metadados ausentes mostram **Não informado**; um agregado incompleto mostra **Parcial**. Antes da contagem, mostra **Aguardando contagem**. Não indica saldo do plano, cobrança em reais ou garantia de consumo menor que Codex. Nova conversa, troca de modelo/agente ou projeto reiniciam os contadores da conversa.

## Arquivos e permissões

ChatGPT mantém aprovação por escrita/comando e as verificações de caminho, links externos, segredos, leitura prévia e conflito no disco. Escritas diretas por ferramenta recusam arquivos com alterações não salvas no editor. Comandos PowerShell aprovados herdam os privilégios do usuário e podem acessar outras pastas/rede.

Codex mantém autorização inicial por tarefa com sandbox `workspace-write`, sem novas confirmações individuais da janela. Salve os buffers antes de iniciar. Escritas por shell/Codex externo não passam pelo guard de escrita do ChatAgente; a IDE mantém seus próprios avisos de conflito de arquivo. Parar tenta cancelar a execução; efeitos já aplicados não são revertidos.

Credenciais ChatGPT ficam cifradas com AES-GCM no perfil; a chave fica no SecretStorage da IDE. Inicialização e renovação são coordenadas entre janelas. Tokens não são enviados ao painel nem incluídos nos pacotes. A conversa fica na memória, sem histórico persistente implementado.

## Base e compatibilidade

A base fixada em [ide-base.json](ide-base.json) é VSCodium **1.143.17232**, derivada de Code OSS, com hash SHA-256 verificado antes da extração. Licenças e avisos de terceiros são preservados, assim como a loja **Open VSX**. Recursos exclusivos dos serviços/loja Microsoft não são presumidos compatíveis. A integração de agentes é do ChatAgente: não representa identidade de modelos ou equivalência certificada com a extensão proprietária Codex.

Atualizações da base não substituem automaticamente a distribuição personalizada. As versões anteriores do MVP permanecem no histórico do repositório e em Releases.

## Desenvolver e gerar pacotes

Windows x64, Node.js 22+, npm, PowerShell e Git:

```powershell
npm install
npm run prepare:ide
npm run dev
```

`prepare:ide` baixa a base oficial fixada, verifica o hash e prepara `out/ide-app`. `dev` atualiza a integração local antes de abrir a IDE. A distribuição inclui os módulos de agente/autenticação de `src/` em `runtime/` da extensão e somente dependências de produção. Não copie perfis, `.env`, tokens ou dados pessoais para a pasta preparada.

```powershell
npm test
npm run test:ide
npm run dist:win
```

`npm test`: testes locais com inferência simulada, arquivos/PowerShell reais, execução acima de 64 rodadas, cancelamento, proteção de buffers, validação de mensagens e autenticação concorrente. `test:ide`: teste real da IDE com perfil e projeto temporários, edição/salvamento, Git, terminal persistente, Ctrl+C e seleção dos dois agentes. Não consome inferência.

`dist:win` gera instalador e ZIP em `dist/`. O protótipo Electron anterior pode ser aberto com `npm run dev:legacy`; não é a base padrão da versão 0.2.0.

## Estado da validação

**46 testes locais aprovados** e teste da IDE real aprovado. O teste do chat central percorre o runtime e o bridge com metadados de uma resposta simulada, conferindo o contador sem consumir uma conta. **Login e inferência reais dos dois agentes ainda não foram validados por um teste controlado com conta.** Não há promessa de memória ilimitada, equivalência de todos os serviços/extensões proprietários ou inferência gratuita.

Fontes técnicas consultadas em 08/11/2026: [VSCodium](https://github.com/VSCodium/vscodium), [Webviews](https://code.visualstudio.com/api/extension-guides/webview), [VS Code API](https://code.visualstudio.com/api/references/vscode-api), [empacotamento Windows](https://www.electron.build/nsis/). Licença do ChatAgente: MIT.
