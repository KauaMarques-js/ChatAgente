# Plano de implementação e aceitação

Etapas propostas. O objetivo final inclui navegador e controle do computador; concluir apenas o núcleo não encerra o produto completo.

| Etapa | Entrega | Verificação necessária |
| --- | --- | --- |
| 0 | Inspeção, decisões técnicas e resolução das políticas bloqueadoras | Registrar base encontrada, versões, comandos e propostas pendentes |
| 1 | Janela desktop, projeto selecionável e configuração da integração | Abrir no Windows e persistir configuração sem expor credenciais |
| 2 | Chat real, streaming e ciclo de ferramentas | Executar uma tarefa com chamadas reais, erros claros e cancelamento |
| 3 | Arquivos, editor, terminal e diferenças Git | Alterar projeto de exemplo, executar verificação e mostrar diff real |
| 4 | Histórico, recuperação e revisão de mudanças | Reiniciar aplicativo e recuperar conversa sem repetir efeitos |
| 5 | Git de escrita e automação de navegador | Criar branch/commit em repositório temporário e testar página local |
| 6 | Controle do Windows e extensões MCP | Interagir com aplicativo de exemplo e servidor de teste autorizado |
| 7 | Empacotamento e documentação de uso | Instalar ou abrir pacote em ambiente Windows e validar jornada principal |

## Cenário principal do núcleo

Em um projeto de exemplo com erro conhecido, pedir ao agente que investigue e corrija o defeito. Ele deve ler contexto pertinente, realizar a alteração, executar uma verificação e apresentar arquivos alterados e resultado real. O usuário consegue revisar o diff e interromper uma nova tarefa em andamento.

## Testes focados nos riscos

- Arquivos: caminhos com espaços e acentos, arquivo bloqueado, mudança concorrente e tentativa de acesso fora do modo concedido, incluindo links/junctions.
- Processos: saída extensa, erro, timeout, interrupção e processo filho. Confirmar o que foi efetivamente encerrado.
- Git: alterações preexistentes preservadas, comando malsucedido exibido, diff correto e operação de escrita somente dentro da autorização vigente.
- Agente: argumentos inválidos, ferramenta desconhecida, falha de rede, cancelamento, ciclo sem progresso e conteúdo externo tentando modificar permissões.
- Interface e armazenamento: segredo ausente de mensagens, logs e histórico; recuperação de tarefa incompleta; ações acompanháveis por teclado.
- Navegador/Windows: cenário local previsível, alvo correto, evidência de resultado e interrupção; não usar contas pessoais para validar.

Testes com respostas simuladas são úteis para falhas e estados, mas não comprovam conexão OpenAI. Sem credenciais ou autorização de uso pago, registrar a validação externa como não executada e manter o aplicativo pronto para configuração.

## Critério de conclusão

Cada capacidade entregue possui comportamento real e evidência reproduzível. Registrar comandos, códigos de saída, resultado de testes, cenário manual, versão e limitações. Falhas e verificações não executadas ficam explícitas. Não marcar etapa como concluída apenas porque a interface existe.

Entregar instruções de instalação e configuração, uso das permissões, custos externos a verificar, local dos dados, exclusão do histórico e limites da recuperação. Não publicar nem assinar pacote com credenciais do usuário sem autorização correspondente.
