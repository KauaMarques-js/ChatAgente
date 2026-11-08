# ChatAgente

Aplicativo desktop **Windows** simples com chat de agente OpenAI. Usa ferramentas reais na pasta do projeto para ler e criar arquivos, executar comandos no PowerShell e consultar o Git. As ações do agente que escrevem arquivos ou executam comandos pedem aprovação na própria janela.

## Início rápido

Requer Windows com **Node.js 20+**, npm, Git e PowerShell instalados.

```powershell
cd C:\Dev\agenteChat
npm install
Copy-Item .env.example .env
notepad .env
npm run dev
```

No `.env`, preencha `OPENAI_API_KEY` com uma chave válida obtida na plataforma de API OpenAI. A chave **não deve ser publicada**. O modelo inicial é `gpt-5.4-mini`, alterável em `OPENAI_MODEL` (precisa estar disponível na conta). Depois de alterar `.env`, reinicie `npm run dev`.

**A assinatura do ChatGPT não inclui automaticamente créditos da API.** O uso de modelos pela API pode gerar cobranças conforme consumo. O ChatAgente não acessa a sessão do site do ChatGPT nem tenta contornar autenticação. Não envia solicitações de API ao abrir a janela: o primeiro uso ocorre ao enviar uma mensagem.

## Como usar

1. Escolha **Selecionar pasta** para definir o projeto (por padrão, é a pasta de onde o app foi aberto).
2. Peça algo como: “Leia o README do projeto, ajuste o erro e rode o teste”.
3. Acompanhe a atividade; aprove cada comando ou escrita após conferir o conteúdo. **Comandos PowerShell aprovados têm o mesmo acesso do seu usuário Windows**, podendo sair da pasta do projeto.
4. Consulte **Ver status** e **Ver alterações** para revisar mudanças no Git. Para comandos seus, digite no terminal PowerShell integrado, que executa diretamente o texto digitado.
5. Use **Parar** para interromper uma tarefa ou processo em curso, e **Nova conversa** para reiniciar o contexto do chat.

Os arquivos são modificados de verdade. O agente limita ferramentas diretas de arquivos à pasta selecionada, bloqueia acesso direto a `.env`, chaves privadas e `.git`, exige ler antes de sobrescrever e detecta conflitos de edição. Links e junctions que escapam da pasta são bloqueados. O shell aprovado pode acessar outros lugares: reveja cuidadosamente os comandos solicitados.

## O que já funciona e o que falta

**Incluído:** janela Electron, modelo OpenAI via Responses API com streaming, chamadas de funções e aprovação, projeto selecionável, arquivos, PowerShell, Git status/diff, erros e cancelamento. O histórico do chat é apenas **em memória**; a cada reinício ou alteração de projeto, começa nova conversa. A chave fica no `.env` local ignorado pelo Git, e as mensagens não são armazenadas intencionalmente pela aplicação. Nas requisições usa-se `store: false`.

**Fora do primeiro MVP:** automação do navegador, controle de outras janelas do Windows, Git com botões de commit/push, editor de código, persistência de histórico e instalador `.exe`. Operações de Git via PowerShell são possíveis, desde que aprovadas. A seleção da pasta não limita processos arbitrários do PowerShell a ela; a segurança do modo completo ainda depende de decisões de produto em `docs/regras-de-negocio.md`.

Para rodar testes locais sem chave de API: `npm test`. Sem uma chave válida, a integração remota não pode ser verificada. A pasta `docs/` documenta a visão completa e a evolução planejada.

## Referências técnicas consultadas (08/11/2026)

- API e chamadas de função: https://developers.openai.com/api/docs/guides/function-calling
- Gerenciamento de contexto: https://developers.openai.com/api/docs/guides/conversation-state
- SDK oficial: https://github.com/openai/openai-node/blob/main/docs/responses.md
- Segurança Electron: https://www.electronjs.org/docs/latest/tutorial/security
