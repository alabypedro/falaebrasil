Para implementar o chatbot de Writing e Listening com as APIs da Microsoft, seguiremos este plano:

### 1. Preparação (O que você precisa fazer)
Você precisará coletar as chaves no Portal da Azure e adicioná-las aos Secrets do Lovable (ícone de cadeado no menu lateral):
*   **Azure OpenAI**:
    1.  Crie um recurso de "Azure OpenAI" no [Portal da Azure](https://portal.azure.com/).
    2.  No Azure OpenAI Studio, faça um "Deployment" do modelo `gpt-4o`.
    3.  Pegue: `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT` e o `AZURE_OPENAI_DEPLOYMENT_NAME`.
*   **Azure AI Speech**: (Você já tem `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` configurados, mas confirme se são do mesmo recurso).

### 2. Implementação Técnica
*   **Edge Function (`writing-listening-chat`):** Criarei uma nova função que servirá de ponte entre o app e o Azure OpenAI. Ela processará as mensagens de texto e áudio (usando Speech-to-Text do Azure) para avaliar o progresso do aluno.
*   **Página `WritingLab.tsx`:** Uma nova interface de chat moderna onde o aluno pode digitar ou enviar áudio.
*   **Integração de Áudio:** O chatbot usará a transcrição do Azure para avaliar o "Listening" (ditado ou resposta oral) e o GPT-4o para avaliar a gramática e coesão do "Writing".
*   **Navegação:** Adicionarei o "Writing Lab" ao menu lateral para fácil acesso.

### Detalhes Técnicos
*   Utilizaremos o `fetch` para chamadas diretas às APIs REST do Azure dentro das Edge Functions para máxima performance.
*   O estado do chat será mantido no frontend para uma experiência fluida.
*   As avaliações serão salvas no banco de dados para que o aluno veja seu histórico de evolução.

Vou começar criando a estrutura básica da página e da Edge Function enquanto você prepara as chaves.
