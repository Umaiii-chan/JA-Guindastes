// Markdown mínimo para os textos do assistente (TASK-076): títulos, parágrafos, listas, tabelas,
// separador e, dentro do texto, **negrito**, *itálico* e `código`. É um subconjunto de propósito: o
// resultado é uma árvore de dados (nada de HTML), desenhada por `presentation/ai/Markdown.tsx`, então
// o texto da IA nunca vira marcação da página.

export type InlineNode =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'bold'; readonly text: string }
  | { readonly kind: 'italic'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }

export type MarkdownBlock =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3 | 4; readonly inline: InlineNode[] }
  | { readonly kind: 'paragraph'; readonly inline: InlineNode[] }
  | {
      readonly kind: 'list'
      readonly ordered: boolean
      readonly items: readonly InlineNode[][]
    }
  | {
      readonly kind: 'table'
      readonly header: readonly InlineNode[][]
      readonly rows: readonly (readonly InlineNode[][])[]
    }
  | { readonly kind: 'rule' }

const INLINE =
  /\*\*(.+?)\*\*|`([^`]+)`|(?<![*\w])\*([^*\s][^*]*?)\*(?!\*)|(?<![\w_])_([^_\s][^_]*?)_(?![\w_])/g

/** Texto com ênfases → nós inline. Marcas sem par ficam como texto. */
export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let last = 0
  for (const match of source.matchAll(INLINE)) {
    const index = match.index
    if (index > last) nodes.push({ kind: 'text', text: source.slice(last, index) })
    if (match[1] !== undefined) nodes.push({ kind: 'bold', text: match[1] })
    else if (match[2] !== undefined) nodes.push({ kind: 'code', text: match[2] })
    else nodes.push({ kind: 'italic', text: match[3] ?? match[4] ?? '' })
    last = index + match[0].length
  }
  if (last < source.length) nodes.push({ kind: 'text', text: source.slice(last) })
  return nodes
}

const HEADING = /^(#{1,4})\s+(.*?)\s*#*\s*$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*\d+[.)]\s+(.*)$/
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', inline: parseInline(paragraph.join(' ')) })
      paragraph = []
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (line.trim() === '') {
      flushParagraph()
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flushParagraph()
      blocks.push({
        kind: 'heading',
        level: Math.min(4, (heading[1] ?? '#').length) as 1 | 2 | 3 | 4,
        inline: parseInline(heading[2] ?? ''),
      })
      continue
    }
    if (RULE.test(line)) {
      flushParagraph()
      blocks.push({ kind: 'rule' })
      continue
    }
    if (TABLE_ROW.test(line) && TABLE_SEPARATOR.test(lines[index + 1] ?? '')) {
      flushParagraph()
      const header = splitRow(line).map(parseInline)
      const rows: InlineNode[][][] = []
      index += 2
      while (index < lines.length && TABLE_ROW.test(lines[index] ?? '')) {
        rows.push(splitRow(lines[index] ?? '').map(parseInline))
        index += 1
      }
      index -= 1
      blocks.push({ kind: 'table', header, rows })
      continue
    }
    const bullet = BULLET.exec(line)
    const ordered = bullet ? null : ORDERED.exec(line)
    const item = bullet ?? ordered
    if (item) {
      flushParagraph()
      const isOrdered = ordered !== null
      const items: InlineNode[][] = [parseInline(item[1] ?? '')]
      while (index + 1 < lines.length) {
        const next = lines[index + 1] ?? ''
        const match = isOrdered ? ORDERED.exec(next) : BULLET.exec(next)
        if (!match) break
        items.push(parseInline(match[1] ?? ''))
        index += 1
      }
      blocks.push({ kind: 'list', ordered: isOrdered, items })
      continue
    }
    paragraph.push(line.trim())
  }
  flushParagraph()
  return blocks
}

/** Nome de arquivo seguro para exportar um texto (sem acentos nem caracteres especiais). */
export function markdownFileName(title: string, date: Date = new Date()): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const day = date.toISOString().slice(0, 10)
  return `${slug === '' ? 'documento' : slug}-${day}.md`
}
