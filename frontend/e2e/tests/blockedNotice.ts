// Espera pelo aviso «comando bloqueado» da cena (TASK-053; TASK-069), compartilhada pelos e2e que o
// provocam (TASK-114).
//
// Esse aviso dura 2 s e some sozinho (`BLOCKED_NOTICE_HOLD_MS`), e `toBeVisible` AMOSTRA o DOM. Na falha
// do CI (run 39041689294, `collision.spec.ts`), o trace mostra o aviso no DOM quando o `expect` começou
// (16 243 ms) e já ausente na amostra seguinte (18 588 ms), com a página lenta (um `toHaveCount(1)`
// trivial levou 3,1 s; sem GPU, a cena 3D roda no SwiftShader): a amostragem útil só aconteceu depois
// que o aviso expirou. Um `MutationObserver` roda no instante em que o aviso entra no DOM, e por isso a
// observação começa ANTES do comando que o provoca.

import type { Page } from '@playwright/test'

/** Quanto esperar o aviso entrar no DOM; só há falha se ele nunca entrar. */
const NOTICE_TIMEOUT_MS = 15_000

/**
 * Passa a observar o DOM e devolve a espera pelo aviso, que resolve com o texto do aviso no instante
 * em que ele entrou. Falha se o aviso já estiver no DOM ao começar a observar: um aviso antigo (a
 * retenção é de 2 s) resolveria a espera sem o comando ter feito nada.
 */
export async function watchBlockedNotice(page: Page): Promise<() => Promise<string>> {
  const alreadyThere = await page.evaluate((timeoutMs) => {
    const target = window as unknown as { __blockedNotice?: Promise<string> }
    const noticeText = (): string | null =>
      [...document.querySelectorAll('[role="alert"]')]
        .map((element) => element.textContent ?? '')
        .find((text) => /bloqueado/.test(text)) ?? null
    if (noticeText() !== null) return true
    target.__blockedNotice = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        observer.disconnect()
        reject(new Error(`o aviso «comando bloqueado» não entrou no DOM em ${timeoutMs / 1000} s`))
      }, timeoutMs)
      // A entrada do aviso é nó novo ou texto novo; mudanças de atributo (o HUD muda a toda hora) não
      // interessam.
      const observer = new MutationObserver(() => {
        const text = noticeText()
        if (text === null) return
        clearTimeout(timer)
        observer.disconnect()
        resolve(text)
      })
      observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    return false
  }, NOTICE_TIMEOUT_MS)
  if (alreadyThere) {
    throw new Error('o aviso «comando bloqueado» já estava no DOM antes do comando')
  }
  return () =>
    page.evaluate(() => (window as unknown as { __blockedNotice: Promise<string> }).__blockedNotice)
}
