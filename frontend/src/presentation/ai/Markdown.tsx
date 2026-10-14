import type { ReactNode } from 'react'

import { type InlineNode, type MarkdownBlock, parseMarkdown } from '../../application/ai/markdown'
import styles from './Markdown.module.css'

function renderInline(nodes: readonly InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case 'bold':
        return <strong key={index}>{node.text}</strong>
      case 'italic':
        return <em key={index}>{node.text}</em>
      case 'code':
        return <code key={index}>{node.text}</code>
      case 'text':
        return node.text
    }
  })
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  switch (block.kind) {
    case 'heading': {
      // O título do texto vira h3 a h5 na página: o h1/h2 da página e do diálogo já existem.
      const Tag = (['h3', 'h3', 'h4', 'h5'] as const)[block.level - 1] ?? 'h5'
      return <Tag key={index}>{renderInline(block.inline)}</Tag>
    }
    case 'paragraph':
      return <p key={index}>{renderInline(block.inline)}</p>
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </Tag>
      )
    }
    case 'table':
      return (
        <div key={index} className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th key={cellIndex} scope="col">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'rule':
      return <hr key={index} />
  }
}

/** Desenha um texto Markdown do assistente como elementos da página (nunca como HTML cru). */
export function Markdown({
  source,
  className,
}: {
  readonly source: string
  readonly className?: string
}) {
  return (
    <div className={className ? `${styles.markdown} ${className}` : styles.markdown}>
      {parseMarkdown(source).map(renderBlock)}
    </div>
  )
}
