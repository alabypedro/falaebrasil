# Ranking de XP na página inicial

## Objetivo
Exibir na página inicial os cinco alunos com maior XP, destacando ouro, prata e bronze e mantendo o restante compacto e fácil de comparar.

## Implementação
- Usar a fonte segura de ranking já disponível, sem expor dados pessoais além de nome, avatar, nível e XP.
- Adicionar um bloco “Ranking de XP” abaixo dos indicadores atuais.
- Criar um pódio visual para 1º, 2º e 3º, com medalhas e destaque especial para o líder.
- Mostrar 4º e 5º em uma lista compacta, com posição, avatar, nível e pontuação.
- Destacar a posição do aluno conectado quando ele estiver no Top 5.
- Incluir estados de carregamento e lista vazia, mantendo boa leitura no celular e no computador.

## Detalhes técnicos
- Alterar somente a página inicial.
- Consultar a visão protegida `xp_ranking`, ordenada por posição e limitada a cinco registros.
- Reutilizar os componentes, cores e animações já existentes no projeto.
- Validar a compilação e a aparência final no navegador.
