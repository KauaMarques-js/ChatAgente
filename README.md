# ChatAgente

IDE desktop para Windows com **dois agentes selecionáveis: ChatGPT e Codex**. O ChatGPT atua pelo mecanismo próprio de ferramentas do ChatAgente (arquivos, terminal PowerShell e Git). O Codex funciona por meio do SDK oficial e do login do Codex CLI.

## Iniciar

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

No **ChatGPT**, cada comando sugerido pelo agente e cada escrita de arquivo exigem autorização na janela; os acessos diretos a arquivos são limitados ao projeto e protegem segredos conhecidos. Comandos PowerShell aprovados herdam as permissões do seu usuário Windows e podem acessar pastas externas. No **Codex**, cada tarefa pede autorização inicial para trabalhar em `workspace-write`; as ações individuais são executadas pelo SDK no sandbox do Codex sem novas confirmações da janela. Consulte o Git diff antes de aceitar alterações sensíveis.

Os históricos dos dois agentes são independentes na memória do processo. Selecionar outro agente ou modelo inicia uma nova conversa visual, e reiniciar o app descarta esse histórico. **Parar** tenta cancelar a execução ou o login em andamento. **Desconectar desta IDE** apaga as credenciais locais e tenta revogar a sessão remota; se não houver confirmação, um aviso orienta a desconexão nas configurações do ChatGPT.

## Contas, privacidade e limitações

O login ChatGPT segue OAuth 2.0/OIDC com PKCE, um callback temporário em `127.0.0.1` e verificação criptográfica do ID token. Credenciais são guardadas localmente com criptografia do Electron `safeStorage`, fora do Git; o processo de interface não recebe tokens. O app envia mensagens e conteúdo de ferramentas necessário à OpenAI para executar tarefas, com `store: false` nas chamadas de Responses e streaming habilitado.

O uso do plano ChatGPT depende das permissões concedidas, dos modelos disponíveis, das políticas da conta e dos limites do serviço. O aplicativo **não acessa seu histórico de conversas do ChatGPT**. O modo Codex depende do login e do ambiente Codex instalados na máquina.

Este MVP não inclui editor de código visual, navegador automatizado, memórias persistentes, pacote instalador ou edição compartilhada. Mantém uma conexão ChatGPT por instalação; o seletor de múltiplas contas/workspaces ainda não foi implementado. O suporte a ferramentas disponíveis por login ChatGPT pode variar conforme o modelo e a conta.

## Validação

```powershell
npm test
npm run dev
```

Há testes locais para ferramentas, PowerShell, arquivos, armazenamento de credenciais e eventos simulados do Codex. O fluxo OAuth é testado com provedor simulado, callback HTTP local real, assinatura de ID token, PKCE, rejeição de state inválido, catálogo, refresh concorrente e revogação. **Login de uma conta ChatGPT e inferência real ainda não foram validados**; o titular precisa concluir o consentimento no navegador. Os testes não consomem API paga nem franquia do plano.

## Referências oficiais (08/11/2026)

- Sign in with ChatGPT para apps locais: https://developers.openai.com/siwc/token-sharing-open-source
- Login OAuth e permissões: https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- Modelos e inferência: https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- Limites da prévia: https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- SDK Codex: https://developers.openai.com/codex/sdk
- Electron SafeStorage: https://www.electronjs.org/docs/latest/api/safe-storage

O produto é um projeto pessoal de código aberto e não é um aplicativo oficial da OpenAI.
