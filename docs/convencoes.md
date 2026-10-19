# Convenções

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```
tipo(escopo): resumo breve

Descrição (corpo): o porquê da mudança, não o que ela faz.
```

Padrão do projeto: `tipo(escopo): resumo` + descrição. Tipo, escopo e descrição são obrigatórios. Resumo: imperativo, minúsculo, sem ponto final, até 72 caracteres. A descrição vem depois de uma linha em branco e explica o porquê (o diff já mostra o quê).

| Tipo | Quando |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de defeito |
| `refactor` | Muda a estrutura sem mudar o comportamento |
| `perf` | Melhora desempenho |
| `test` | Adiciona ou corrige teste |
| `docs` | Só documentação |
| `build` | Dependências, Dockerfile |
| `ci` | Workflow, lefthook, pipeline |
| `chore` | Manutenção que não entra nas anteriores |
| `style` | Formatação |
| `revert` | Desfaz um commit anterior |

Escopos: `proxy` · `auth` · `ratelimit` · `cors` · `metrics` · `config` · `docker` · `k8s` · `helm` · `deps`

Em `docs`, o escopo é o assunto do documento: `docs(prd)`, `docs(arquitetura)`, `docs(testes)`, `docs(adr)`, `docs(fases)`, `docs(convencoes)`.

Exemplos:

```
feat(auth): valida RS256 com a chave pública do authorization
fix(proxy): remove x-internal-secret vindo do cliente
test(ratelimit): cobre limite separado em /auth/login
docs(arquitetura): descreve a tabela de rotas
```

Mudança que quebra contrato leva `!` antes dos dois-pontos. O hook `commit-msg` do lefthook recusa
mensagem sem tipo e escopo (`LEFTHOOK=0 git commit` para pular pontualmente).

## Autoria

Todo commit e todo PR saem **só com o autor do repositório**: conta do GitHub dele no `gh` (`gh auth status`) e
`user.email` ligado a essa conta. Sem linha `Co-Authored-By`, sem assistente de IA como coautor e sem texto de
atribuição no corpo do PR. O gráfico de Contributors conta autor e coautor; e-mail de outra conta ou trailer de
coautoria vira "contribuidor" que não existe.

## Branches e Pull Requests

`feat/nome-descritivo` ou `fix/nome-descritivo`, em inglês, kebab-case. PR por mudança via `gh pr create`,
título no formato do commit, merge sem rebase. Mudança de contrato ou rota atualiza o doc no mesmo PR.

## Idioma

| O quê | Idioma |
|---|---|
| Commits, branches, PRs, títulos de issue | Inglês |
| Documentação, corpo de issue e comentários | Português |
| Identificadores de código e campos de JSON | Inglês |
| Mensagens de erro devolvidas na API | Português (`"token expirado"`) |
