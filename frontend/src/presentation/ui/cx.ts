/** Junta classes CSS, ignorando valores falsos (útil com CSS Modules e variantes opcionais). */
export function cx(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
