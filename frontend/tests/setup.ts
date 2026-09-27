// Preparação comum dos testes (TASK-039). Nos arquivos que rodam no jsdom, desmonta o que a Testing
// Library montou depois de cada teste (sem `globals: true`, ela não faz isso sozinha).

import { afterEach } from 'vitest'

afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
