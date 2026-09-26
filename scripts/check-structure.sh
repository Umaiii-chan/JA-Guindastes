#!/usr/bin/env bash
# =============================================================================
# check-structure.sh — valida a estrutura do workflow de múltiplas IAs
#
# Verificações determinísticas, sem IA, sem dependências além de bash/grep/find.
# Roda localmente (bash scripts/check-structure.sh) e no CI (.github/workflows/ci.yml).
#
# Saída: código 0 se tudo ok; 1 se houver erro. Avisos não falham.
# Variável STRICT=1 transforma avisos em erros (útil quando o projeto amadurecer).
# =============================================================================
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

STRICT="${STRICT:-0}"
errors=0
warnings=0

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }

fail() { red    "  ✗ $*"; errors=$((errors + 1)); }
warn() { yellow "  ! $*"; warnings=$((warnings + 1)); }
ok()   { green  "  ✓ $*"; }

# -----------------------------------------------------------------------------
echo "1. Arquivos obrigatórios do protocolo"
# -----------------------------------------------------------------------------
required_files=(
  AGENTS.md
  README.md
  docs/README.md
  docs/project-overview.md
  docs/architecture.md
  docs/business-rules.md
  docs/development-guide.md
  docs/testing-strategy.md
  docs/security.md
  docs/known-gaps.md
  docs/templates/task-template.md
  docs/templates/handoff-template.md
  docs/templates/code-review-template.md
  docs/decisions/ADR-000-template.md
  docs/checklists/implementation-checklist.md
  docs/checklists/code-review-checklist.md
  docs/checklists/definition-of-done.md
  docs/policies/anti-hallucination.md
  docs/policies/security.md
  handoffs/current.md
  .github/pull_request_template.md
  .github/workflows/ci.yml
)
for f in "${required_files[@]}"; do
  if [[ -f "$f" ]]; then ok "$f"; else fail "faltando: $f"; fi
done

required_dirs=(tasks/backlog tasks/in-progress tasks/completed handoffs/history)
for d in "${required_dirs[@]}"; do
  if [[ -d "$d" ]]; then ok "$d/"; else fail "faltando diretório: $d/"; fi
done

# -----------------------------------------------------------------------------
echo "2. Handoff atual (handoffs/current.md)"
# -----------------------------------------------------------------------------
if [[ -f handoffs/current.md ]]; then
  size=$(wc -c < handoffs/current.md | tr -d ' ')
  if (( size < 200 )); then
    fail "handoffs/current.md tem apenas ${size} bytes — parece vazio"
  else
    ok "tamanho: ${size} bytes"
  fi
  # seções mínimas do template (busca tolerante a numeração/acentuação)
  for section in "O que foi feito" "Arquivos modificados" "Comandos executados" "Próximo passo"; do
    if grep -qi "$section" handoffs/current.md; then
      ok "seção presente: $section"
    else
      fail "seção ausente em handoffs/current.md: $section"
    fi
  done
fi

# -----------------------------------------------------------------------------
echo "3. Tarefas"
# -----------------------------------------------------------------------------
shopt -s nullglob
in_progress=(tasks/in-progress/*.md)
n_in_progress=${#in_progress[@]}
# Máximo de tarefas em paralelo: decisão da pessoa responsável em 2026-09-26 (TASK-006: 4; TASK-021: 15).
max_in_progress=15
if (( n_in_progress > max_in_progress )); then
  fail "há ${n_in_progress} tarefas em tasks/in-progress/ (máximo: ${max_in_progress})"
elif (( n_in_progress >= 2 )); then
  warn "há ${n_in_progress} tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos"
else
  ok "${n_in_progress} tarefa(s) em in-progress"
fi

for t in "${in_progress[@]}"; do
  base=$(basename "$t")
  if [[ ! "$base" =~ ^TASK-[0-9]{3,}-[a-z0-9-]+\.md$ ]]; then
    fail "nome fora do padrão TASK-NNN-slug.md: $t"
  fi
  if ! grep -qi "Critérios de aceite" "$t"; then
    fail "tarefa sem seção 'Critérios de aceite': $t"
  fi
  if ! grep -qE '^- \[[ x]\] \*\*CA-[0-9]+\*\*' "$t"; then
    warn "tarefa sem critérios no formato '- [ ] **CA-n** — ...': $t"
  fi
  # handoff da tarefa: handoffs/TASK-NNN.md (tarefas em paralelo) ou menção em handoffs/current.md
  id=$(echo "$base" | grep -oE '^TASK-[0-9]+')
  if [[ ! -f "handoffs/${id}.md" ]] && [[ -f handoffs/current.md ]] && ! grep -q "$id" handoffs/current.md; then
    fail "tarefa em andamento $id sem handoff: crie handoffs/${id}.md (ou mencione-a em handoffs/current.md)"
  fi
done

# IDs duplicados entre pastas
all_ids=$(find tasks -name 'TASK-*.md' -printf '%f\n' 2>/dev/null | grep -oE '^TASK-[0-9]+' | sort)
dups=$(echo "$all_ids" | uniq -d)
if [[ -n "$dups" ]]; then
  fail "IDs de tarefa duplicados: $(echo "$dups" | tr '\n' ' ')"
else
  ok "nenhum ID de tarefa duplicado"
fi

# -----------------------------------------------------------------------------
echo "4. Contexto mínimo do projeto (marcadores <preencher>)"
# -----------------------------------------------------------------------------
context_files=(docs/project-overview.md docs/architecture.md docs/business-rules.md docs/development-guide.md)
pending_total=0
for f in "${context_files[@]}"; do
  [[ -f "$f" ]] || continue
  n=$(grep -c '<preencher>' "$f" || true)
  pending_total=$((pending_total + n))
  if (( n > 0 )); then
    warn "$f ainda tem ${n} marcador(es) <preencher>"
  else
    ok "$f sem marcadores <preencher>"
  fi
done
if (( pending_total > 0 && n_in_progress > 0 )); then
  fail "há tarefa em in-progress mas o contexto mínimo tem ${pending_total} marcador(es) <preencher> — preencha docs/ antes de implementar (AGENTS.md § 1)"
fi

# -----------------------------------------------------------------------------
echo "5. Segurança básica"
# -----------------------------------------------------------------------------
if [[ -f .gitignore ]] && grep -qE '^\.env(\s|$)' .gitignore; then
  ok ".env está no .gitignore"
else
  fail ".env não está no .gitignore"
fi

tracked_env=$(git ls-files 2>/dev/null | grep -E '(^|/)\.env(\.[^e]|$)' | grep -v '\.env\.example$' || true)
if [[ -n "$tracked_env" ]]; then
  fail "arquivo .env versionado: $tracked_env"
else
  ok "nenhum .env versionado"
fi

# padrões grosseiros de segredo em arquivos versionados (primeira triagem, não substitui secret scanning)
secret_hits=$(git ls-files 2>/dev/null \
  | grep -vE '^(reference/|.*\.lock$|.*lock\.json$|scripts/check-structure\.sh$)' \
  | xargs grep -nEI '(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,})' 2>/dev/null || true)
if [[ -n "$secret_hits" ]]; then
  fail "possível segredo em arquivo versionado:"
  echo "$secret_hits" | head -n 10 | sed 's/^/      /'
else
  ok "nenhum padrão óbvio de segredo encontrado"
fi

# -----------------------------------------------------------------------------
echo "6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)"
# -----------------------------------------------------------------------------
broken=0
while IFS= read -r file; do
  dir=$(dirname "$file")
  # captura o alvo de [texto](alvo) ignorando URLs, âncoras e imagens
  while IFS= read -r target; do
    [[ -z "$target" ]] && continue
    [[ "$target" =~ ^(http|https|mailto): ]] && continue
    [[ "$target" =~ ^# ]] && continue
    path="${target%%#*}"
    [[ -z "$path" ]] && continue
    if [[ "$path" = /* ]]; then resolved=".$path"; else resolved="$dir/$path"; fi
    if [[ ! -e "$resolved" ]]; then
      fail "link quebrado em $file → $target"
      broken=$((broken + 1))
    fi
  done < <(grep -oE '\]\([^)]+\)' "$file" | sed -E 's/^\]\(//; s/\)$//' | grep -vE '^<' || true)
done < <(find AGENTS.md README.md docs tasks handoffs -name '*.md' 2>/dev/null)
(( broken == 0 )) && ok "nenhum link interno quebrado"

# -----------------------------------------------------------------------------
echo "7. Branches"
# -----------------------------------------------------------------------------
current_branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
if [[ -z "$current_branch" ]]; then
  ok "HEAD desanexado (checkout de CI) — verificação de nome de branch ignorada"
else
  case "$current_branch" in
    development|homologation|production)
      ok "branch longa: $current_branch"
      if [[ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]]; then
        warn "há alterações não commitadas em '$current_branch' — o trabalho de tarefa deve ficar em task/TASK-NNN-slug"
      fi
      ;;
    task/TASK-[0-9]*)
      ok "branch de tarefa: $current_branch"
      branch_id=$(echo "$current_branch" | grep -oE 'TASK-[0-9]+')
      if (( n_in_progress > 0 )); then
        found=0
        for t in "${in_progress[@]}"; do
          [[ "$(basename "$t")" == "$branch_id"-* ]] && found=1
        done
        if (( found == 0 )); then
          warn "branch '$current_branch' não corresponde a nenhuma tarefa em tasks/in-progress/"
        fi
      fi
      ;;
    hotfix/*)
      ok "branch de hotfix: $current_branch"
      ;;
    *)
      warn "branch '$current_branch' fora do padrão (esperado: development, homologation, production, task/TASK-NNN-slug ou hotfix/<slug>)"
      ;;
  esac
fi

# -----------------------------------------------------------------------------
echo "8. Autoria dos commits (sem co-autoria de IA)"
# -----------------------------------------------------------------------------
# Verifica apenas os commits desta branch que ainda não estão em development —
# ou seja, o que você está prestes a submeter em um PR. Histórico antigo não é
# reescrito por causa desta regra.
base_ref=""
for candidate in development origin/development; do
  if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
    base_ref="$candidate"; break
  fi
done

if [[ -z "$base_ref" ]]; then
  ok "sem branch 'development' para comparar — verificação ignorada"
elif [[ "$current_branch" == "development" || "$current_branch" == "homologation" || "$current_branch" == "production" ]]; then
  ok "branch longa — commits já passaram por PR; verificação ignorada"
else
  ai_trailers=$(git log "${base_ref}..HEAD" --format='%H %s%n%b' 2>/dev/null \
    | grep -inE '^(co-authored-by|assisted-by|generated-by|signed-off-by):.*(claude|anthropic|chatgpt|openai|gpt-[0-9]|copilot|gemini|codex|cursor|windsurf|devin|\[bot\]|noreply@)' || true)
  if [[ -n "$ai_trailers" ]]; then
    fail "commit com rodapé de co-autoria de IA (proibido — ver docs/guides/git-github.md § 2):"
    echo "$ai_trailers" | head -n 5 | sed 's/^/      /'
    echo "      Corrija com: git commit --amend   (último commit)"
    echo "                   git rebase -i $base_ref   ('reword' nos commits afetados)"
  else
    n_commits=$(git rev-list --count "${base_ref}..HEAD" 2>/dev/null || echo 0)
    ok "${n_commits} commit(s) desta branch sem co-autoria de IA"
  fi
fi

# -----------------------------------------------------------------------------
echo
if (( STRICT == 1 && warnings > 0 )); then
  errors=$((errors + warnings))
  yellow "STRICT=1: ${warnings} aviso(s) contados como erro"
fi
if (( errors > 0 )); then
  red "FALHOU: ${errors} erro(s), ${warnings} aviso(s)"
  exit 1
else
  green "OK: 0 erros, ${warnings} aviso(s)"
  exit 0
fi
