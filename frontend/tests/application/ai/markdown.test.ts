// Markdown do assistente de IA (TASK-076): subconjunto desenhado como dados, nunca como HTML.

import { describe, expect, it } from 'vitest'

import { markdownFileName, parseInline, parseMarkdown } from '../../../src/application/ai/markdown'

describe('parseInline', () => {
  it('reconhece negrito, itálico e código, e deixa o resto como texto', () => {
    expect(parseInline('um **forte**, um *leve*, um `x = 1` e _outro_.')).toEqual([
      { kind: 'text', text: 'um ' },
      { kind: 'bold', text: 'forte' },
      { kind: 'text', text: ', um ' },
      { kind: 'italic', text: 'leve' },
      { kind: 'text', text: ', um ' },
      { kind: 'code', text: 'x = 1' },
      { kind: 'text', text: ' e ' },
      { kind: 'italic', text: 'outro' },
      { kind: 'text', text: '.' },
    ])
  })

  it('marcas sem par e underscores no meio da palavra ficam como texto', () => {
    expect(parseInline('a ** solta e snake_case_nome')).toEqual([
      { kind: 'text', text: 'a ** solta e snake_case_nome' },
    ])
  })

  it('HTML no texto continua sendo só texto', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([
      { kind: 'text', text: '<script>alert(1)</script>' },
    ])
  })
})

describe('parseMarkdown', () => {
  it('títulos, parágrafos, listas e separador', () => {
    const blocks = parseMarkdown(
      [
        '# Relatório',
        '',
        'Primeira linha',
        'continua aqui.',
        '',
        '### Pontos',
        '- um',
        '- dois',
        '',
        '1. passo A',
        '2) passo B',
        '',
        '---',
      ].join('\n'),
    )

    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'list',
      'list',
      'rule',
    ])
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({
      kind: 'paragraph',
      inline: [{ kind: 'text', text: 'Primeira linha continua aqui.' }],
    })
    expect(blocks[3]).toMatchObject({ kind: 'list', ordered: false })
    expect((blocks[3] as unknown as { items: unknown[] }).items).toHaveLength(2)
    expect(blocks[4]).toMatchObject({ kind: 'list', ordered: true })
  })

  it('tabela com cabeçalho e linhas', () => {
    const [table] = parseMarkdown(
      ['| Item | Valor |', '| --- | --- |', '| Raio | 9,2 m |', '| **Carga** | 8.000 kg |'].join(
        '\n',
      ),
    )

    expect(table).toMatchObject({ kind: 'table' })
    const typed = table as unknown as {
      header: { text: string }[][]
      rows: { kind: string; text: string }[][][]
    }
    expect(typed.header.map((cell) => cell[0]?.text)).toEqual(['Item', 'Valor'])
    expect(typed.rows).toHaveLength(2)
    expect(typed.rows[1]?.[0]?.[0]).toEqual({ kind: 'bold', text: 'Carga' })
  })

  it('texto vazio não gera blocos e CRLF é aceito', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2)
  })
})

describe('markdownFileName', () => {
  it('tira acentos e caracteres especiais e leva a data', () => {
    expect(markdownFileName('Relatório de içamento', new Date('2026-10-14T12:00:00Z'))).toBe(
      'relatorio-de-icamento-2026-10-14.md',
    )
    expect(markdownFileName('???', new Date('2026-10-14T12:00:00Z'))).toBe(
      'documento-2026-10-14.md',
    )
  })
})
