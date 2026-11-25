/** O foco está num controle que usa o teclado por conta própria (campo, lista, slider…)? */
export function typingInControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest('input, select, textarea, [role="slider"], [role="spinbutton"]') !== null
}
