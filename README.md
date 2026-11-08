# ChatAgente

IDE desktop para Windows com **dois agentes selecionáveis: ChatGPT e Codex**. O ChatGPT atua pelo mecanismo próprio de ferramentas do ChatAgente (arquivos, terminal PowerShell e Git). O Codex funciona por meio do SDK oficial e do login do Codex CLI.

## Iniciar

### Baixar para Windows

Na [versão de testes 0.1.1](https://github.com/KauaMarques-js/ChatAgente/releases/tag/v0.1.1), baixe **ChatAgente-Setup-0.1.1-x64.exe** para instalar, ou **ChatAgente-0.1.1-win.zip** para extrair e executar `ChatAgente.exe` sem instalação. Extraia o ZIP inteiro; mantenha a pasta `resources` ao lado do executável. Não é necessário instalar Node.js/npm para abrir esses pacotes.

Pacotes para Windows x64; abertura verificada no Windows 10. O instalador não possui assinatura digital e o Windows pode exibir aviso de aplicativo desconhecido. Os hashes dos downloads ficam em `SHA256SUMS.txt`. PowerShell é necessário para comandos locais e Git para os recursos Git. Abra **Agente e ferramentas** para autenticar e use **Selecionar pasta** no explorador para escolher seu projeto.

Esta é uma prévia: login ChatGPT e inferência real ainda não foram validados. A conta continua sujeita à disponibilidade e aos limites da OpenAI. O modo Codex inclui o executável, mas usa a autenticação local do Codex CLI (`codex login`). Nenhuma credencial da máquina de desenvolvimento é distribuída.

### Executar pelo código-fonte

Requer Windows, Node.js 22+, npm, PowerShell e Git.

```powershell
cd C:\Dev\agenteChat
npm install
npm run dev
```

Escolha o agente na barra lateral:

- **ChatGPT**: clique em **Continuar com ChatGPT**, conclua o login no navegador e conceda permissão de uso do plano. A integração usa o fluxo oficial *Sign in with ChatGPT* para aplicativos locais de código aberto, quando disponível para a conta. Depois selecione um modelo disponibilizado pela sua conexão. Não é necessário criar `.env`, copiar tokens nem configurar API key.
- **Codex**: autentique uma vez com `codex login` no PowerShell. Se já estiver autenticado, selecione **Codex** na IDE. Esse modo usa o SDK Codex com o projeto selecionado.

O **ChatAgente é gratuito e open source, sob licença MIT**. Isso não torna a inferência da OpenAI gratuita ou ilimitada: disponibilidade, assinatura eventualmente exigida, franquia e créditos dependem da conta. Consulte **Ver uso do plano** e mantenha desativado o uso de créditos adicionais no ChatGPT se não quiser consumo além da franquia. A aplicação não usa `OPENAI_API_KEY` para o agente ChatGPT e não muda para cobrança de API quando o login falha ou o limite acaba. O modo Codex usa a configuração própria do CLI.

## Usar a IDE

Selecione uma pasta de projeto, digite a tarefa e acompanhe a resposta e as operações na coluna Atividade. O terminal integrado aceita comandos PowerShell diretamente, incluindo `npm run dev`, `npm test` e operações Git. Os botões Git mostram status e diferenças da pasta escolhida.

O **Explorador** na lateral mostra a pasta selecionada, com diretórios expansíveis, ícones por tipo de arquivo, seleção e indicadores Git (`M`, `U`, `A`, `R`, `D`). Clique em um arquivo para abrir uma prévia de texto somente leitura; o **✕** volta ao chat. As pastas são carregadas ao expandir, inclusive `node_modules`; `.git` fica oculto. A árvore atualiza após tarefas e comandos e pelo botão **↻**, preservando as pastas abertas. Use o botão **⊟** para recolher. As configurações de agente, login e ferramentas Git ficam em **Agente e ferramentas**, no rodapé da lateral.

A prévia usa os bloqueios existentes para arquivos sensíveis, binários, links externos e textos acima de 100 KB. Ela não envia conteúdo à OpenAI. Alterações externas são atualizadas pelo botão **↻**; reabra um arquivo para recarregar sua prévia. Ainda não há edição de arquivos pela interface.

O PowerShell aparece no painel inferior, com saída em tempo real. Use **Ctrl + '** para abrir/ocultar e focar o terminal, **Enter** para executar e **↑/↓** para recuperar comandos desta sessão. **Ctrl + C**, com foco no terminal e sem texto selecionado, tenta encerrar o comando e seus processos filhos; quando há seleção, preserva a cópia. Também há botões para interromper, limpar a saída e ocultar o painel. Ocultar mantém o comando rodando; comandos manuais não têm o limite de 30 segundos das ferramentas do agente. O histórico de comandos fica somente em memória.

O terminal ainda executa cada envio em um novo PowerShell na pasta do projeto: `cd` e variáveis não persistem entre comandos. Para combinar operações, envie-as juntas, por exemplo `Set-Location subpasta; npm run dev`. Não há suporte a programas interativos que pedem entrada durante a execução. Enquanto um comando estiver rodando, finalize ou interrompa antes de iniciar outra tarefa na IDE.

No **ChatGPT**, cada comando sugerido pelo agente e cada escrita de arquivo exigem autorização na janela; os acessos diretos a arquivos são limitados ao projeto e protegem segredos conhecidos. Comandos PowerShell aprovados herdam as permissões do seu usuário Windows e podem acessar pastas externas. No **Codex**, cada tarefa pede autorização inicial para trabalhar em `workspace-write`; as ações individuais são executadas pelo SDK no sandbox do Codex sem novas confirmações da janela. Consulte o Git diff antes de aceitar alterações sensíveis.

Os históricos dos dois agentes são independentes na memória do processo. Selecionar outro agente ou modelo inicia uma nova conversa visual, e reiniciar o app descarta esse histórico. **Parar** tenta cancelar a execução ou o login em andamento. **Desconectar desta IDE** apaga as credenciais locais e tenta revogar a sessão remota; se não houver confirmação, um aviso orienta a desconexão nas configurações do ChatGPT.

O agente ChatGPT lê até 8 arquivos relacionados por lote, respeitando os bloqueios de acesso. Uma etapa pode usar até 64 rodadas de ferramentas e até 10 minutos; ao chegar ao orçamento de rodadas ou repetir a mesma consulta sem progresso, solicita um resumo sem novas ferramentas e mostra **Pausado · envie continuar**. Envie **continuar** para retomar com os resultados já obtidos. Falhas preservam as rodadas completas na memória, sem repetir automaticamente comandos ou alterações. Reiniciar ou trocar de projeto ainda descarta o contexto.

## Contas, privacidade e limitações

O login ChatGPT segue OAuth 2.0/OIDC com PKCE, um callback temporário em `127.0.0.1` e verificação criptográfica do ID token. Credenciais são guardadas localmente com criptografia do Electron `safeStorage`, fora do Git; o processo de interface não recebe tokens. O app envia mensagens e conteúdo de ferramentas necessário à OpenAI para executar tarefas, com `store: false` nas chamadas de Responses e streaming habilitado.

O uso do plano ChatGPT depende das permissões concedidas, dos modelos disponíveis, das políticas da conta e dos limites do serviço. O aplicativo **não acessa seu histórico de conversas do ChatGPT**. O modo Codex depende do login e do ambiente Codex instalados na máquina.

Este MVP não inclui editor de código visual, navegador automatizado, memórias persistentes ou edição compartilhada. Mantém uma conexão ChatGPT por instalação; o seletor de múltiplas contas/workspaces ainda não foi implementado. O suporte a ferramentas disponíveis por login ChatGPT pode variar conforme o modelo e a conta.

## Validação

```powershell
npm test
npm run dev
npm run dist:win
```

Há testes locais para ferramentas, PowerShell, arquivos, armazenamento de credenciais e eventos simulados do Codex. O fluxo OAuth é testado com provedor simulado, callback HTTP local real, assinatura de ID token, PKCE, rejeição de state inválido, catálogo, refresh concorrente e revogação. **Login de uma conta ChatGPT e inferência real ainda não foram validados**; o titular precisa concluir o consentimento no navegador. Os testes não consomem API paga nem franquia do plano.

## Referências oficiais (08/11/2026)

- Sign in with ChatGPT para apps locais: https://developers.openai.com/siwc/token-sharing-open-source
- Login OAuth e permissões: https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- Modelos e inferência: https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- Limites da prévia: https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- SDK Codex: https://developers.openai.com/codex/sdk
- Electron SafeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
- Empacotamento Windows: https://www.electron.build/configuration/ e https://www.electron.build/nsis/

O produto é um projeto pessoal de código aberto e não é um aplicativo oficial da OpenAI.
