# Guia: Como Solicitar Endpoint de Vendas do PDV ao Suporte Dapic

## Problema Identificado

O sistema de intranet da Saron está integrado com a API Dapic, mas atualmente **as vendas finalizadas do PDV não aparecem** no dashboard. Isso acontece porque o endpoint `/v1/orcamentos` retorna apenas orçamentos/cotações (Status="Aberto"), e não as vendas que você vê nos relatórios do Dapic.

**Exemplo concreto**: 
- Relatório do Dapic mostra: R$ 7.803,14 em vendas (13/11/2025)
- Dashboard intranet mostra: R$ 0,00 (dados não disponíveis via API)

## O Que Você Precisa do Dapic

Você precisa da **documentação oficial** de como acessar as vendas finalizadas do PDV através da API. Especificamente:

1. **Endpoint de vendas do PDV** (possíveis nomes: `/v1/vendas`, `/v1/vendas-pdv`, `/v1/nfe`)
2. **Parâmetros aceitos** (datas, filtros, paginação)
3. **Formato da resposta** (estrutura JSON)
4. **Exemplos de requisição e resposta**

## Passo a Passo para Contatar o Suporte

### 1. Prepare as Informações

Antes de contatar, tenha em mãos:
- ✅ Identificador da sua empresa no Dapic
- ✅ Nome da conta/CNPJ das lojas Saron
- ✅ Token de integração (se já tiver)
- ✅ Este guia (para referência)

### 2. Entre em Contato com a WebPic/Dapic

**Site oficial**: https://www.webpic.com.br

**Opções de contato**:
- 📧 Suporte técnico via site (preferível para solicitações de API)
- 📞 Telefone (consulte no site)
- 💬 Chat online (se disponível)

**Horário de atendimento**: Segunda a sexta, 8h às 18h

### 3. Mensagem Sugerida

Copie e adapte esta mensagem para enviar ao suporte:

---

**Assunto**: Solicitação de Documentação API - Endpoint de Vendas do PDV

Olá equipe Dapic,

Sou cliente da empresa **[NOME DA SUA EMPRESA - CNPJ]** e estou desenvolvendo uma integração com a API Dapic para nosso sistema de intranet.

Atualmente estou usando o endpoint `/v1/orcamentos`, mas identifiquei que ele retorna apenas orçamentos (cotações), não as vendas finalizadas do PDV.

**Preciso acessar os dados de vendas finalizadas** (as mesmas que aparecem nos relatórios de vendas do Dapic) via API.

Gostaria de solicitar:

1. **Documentação do endpoint de vendas do PDV**
   - Endpoint correto (ex: `/v1/vendas`, `/v1/vendas-pdv`, `/v1/nfe`)
   - Parâmetros aceitos (filtros de data, loja, etc)
   - Formato da resposta (estrutura JSON)
   - Exemplos de requisição e resposta

2. **Informações sobre autenticação**
   - O endpoint usa o mesmo token de integração que já possuo?
   - Há alguma permissão adicional necessária?

3. **Limitações técnicas**
   - Rate limits do endpoint
   - Paginação (se aplicável)
   - Período máximo de consulta

**Contexto técnico**:
- Já estou integrado com `/v1/clientes`, `/v1/produtos` e `/v1/orcamentos`
- Autenticação via `/autenticacao/v1/login` funcionando
- Preciso dos dados de vendas para exibir em dashboards executivos

Agradeço desde já a atenção e fico no aguardo do retorno.

Atenciosamente,
**[SEU NOME]**
**[SUA EMPRESA]**

---

### 4. O Que Esperar da Resposta

O suporte Dapic deve fornecer:

✅ **Endpoint correto** para vendas do PDV
✅ **Documentação** com exemplos
✅ **Credenciais** (se necessário)
✅ **Prazo** para liberação (se houver necessidade de ativação)

### 5. Após Receber a Resposta

Quando receber a documentação do endpoint:

1. **Repasse ao desenvolvedor** responsável pela integração
2. **Informe os seguintes detalhes**:
   - URL do endpoint
   - Parâmetros necessários
   - Exemplos de resposta
   - Qualquer requisito de autenticação adicional

3. **O desenvolvedor irá**:
   - Adicionar o novo método em `server/dapic.ts`
   - Criar rota em `server/routes.ts`
   - Atualizar hook `use-dapic.ts`
   - Modificar dashboard para usar dados reais

## Perguntas Adicionais para o Suporte

Se quiser ser ainda mais específico, pergunte também:

📊 **Sobre os dados**:
- O endpoint retorna vendas agrupadas por caixa?
- Inclui formas de pagamento detalhadas?
- Mostra vendedor responsável?
- Há informações de produtos vendidos?

🔐 **Sobre segurança**:
- Posso filtrar por loja específica?
- Há controle de acesso por usuário/perfil?

📅 **Sobre histórico**:
- Posso consultar vendas de períodos passados?
- Qual o período máximo de consulta?

## Contato de Emergência

Se você não conseguir resolver pelo suporte padrão, considere:

- **Consultar com seu gerente de conta** (se tiver)
- **Solicitar suporte técnico avançado**
- **Pedir para falar com a equipe de API/Integrações**

## Arquivos para Compartilhar com o Desenvolvedor

Quando receber a resposta do Dapic, envie ao desenvolvedor:

1. ✅ Este guia
2. ✅ Documentação recebida do Dapic
3. ✅ Exemplos de requisições fornecidos
4. ✅ Credenciais/tokens (se aplicável)

---

## Observações Importantes

⚠️ **Não compartilhe**:
- Tokens de integração publicamente
- Senhas ou credenciais em e-mails não criptografados

✅ **Mantenha seguro**:
- Guarde a documentação em local seguro
- Compartilhe apenas com pessoas autorizadas
- Use canais seguros para enviar credenciais

---

**Última atualização**: 14 de novembro de 2025  
**Criado para**: Saron - Sistema de Gestão Intranet
