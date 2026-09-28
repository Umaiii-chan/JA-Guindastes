/**
 * Símbolo do simulador (ADR-019 § 4): triângulo de lança sobre a base, em traço de tinta. Geométrico
 * e mínimo; nenhuma marca real (nem da Guindastes Ribas, nem de fabricante). Usa `currentColor`, então
 * herda a tinta do texto. O mesmo desenho está em `public/favicon.svg`.
 */
export function BrandMark({ size = 28 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* base (chassi) */}
      <rect x="3" y="24" width="15" height="4" fill="currentColor" />
      {/* lança: a hipotenusa do triângulo, do pé até a ponta */}
      <path d="M8 24 L27 5" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
      {/* cabo e carga: o cateto vertical */}
      <path d="M27 5 V18" stroke="currentColor" strokeWidth="1.25" />
      <rect x="24.5" y="18" width="5" height="4" fill="currentColor" />
      {/* raio: o cateto horizontal, em traço de cota */}
      <path d="M18 26 H29" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
    </svg>
  )
}
