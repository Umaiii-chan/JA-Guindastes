import styles from './HeroIllustration.module.css'

/**
 * Figura 1 do Início: vista lateral do guindaste em traço de desenho técnico, com as cotas do que o
 * simulador mede (raio de trabalho R, inclinação θ e comprimento L da lança). Sem valores: é um
 * esquema, não um caso calculado. Decorativa para leitores de tela; a legenda (`figcaption`) explica.
 */
export function HeroIllustration() {
  return (
    <svg
      className={styles.art}
      viewBox="0 0 520 250"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id="cota-seta"
          viewBox="0 0 8 8"
          refX="8"
          refY="4"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0 1 L8 4 L0 7 Z" className={styles.inkFill} />
        </marker>
        <pattern id="solo" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 10 L10 0" className={styles.thin} />
        </pattern>
      </defs>

      {/* solo */}
      <path d="M24 202 H500" className={styles.ink} />
      <rect x="24" y="203" width="476" height="8" fill="url(#solo)" />

      {/* eixo de giro (traço-ponto) */}
      <path d="M146 96 V238" className={styles.axis} />

      {/* chassi, cabine e rodas */}
      <path d="M58 164 H216 V186 H58 Z" className={styles.body} />
      <path d="M58 164 V136 H90 L100 164" className={styles.body} />
      <path d="M66 142 H86 L91 156 H66 Z" className={styles.thin} />
      <circle cx="84" cy="192" r="10" className={styles.body} />
      <circle cx="126" cy="192" r="10" className={styles.body} />
      <circle cx="190" cy="192" r="10" className={styles.body} />
      <path d="M216 176 H232 V186 H216" className={styles.thin} />

      {/* torre */}
      <path d="M122 164 V148 H174 V164" className={styles.body} />

      {/* lança a 38°: contorno em duas linhas */}
      <path d="M157.5 142.8 L315.5 19.8 L320.5 26.2 L162.5 149.2 Z" className={styles.boom} />
      <circle cx="160" cy="146" r="3.5" className={styles.pin} />

      {/* cabo, moitão e carga */}
      <path d="M318 23 V122" className={styles.ink} />
      <path d="M312 122 H324 V132 H312 Z" className={styles.body} />
      <path d="M318 132 L298 152 M318 132 L338 152" className={styles.thin} />
      <path d="M294 152 H342 V182 H294 Z" className={styles.body} />
      <path d="M294 152 L342 182 M342 152 L294 182" className={styles.thin} />

      {/* cota θ: inclinação da lança */}
      <path d="M160 146 H214" className={styles.thin} />
      <path
        d="M208 146 A48 48 0 0 0 197.8 116.4"
        className={styles.ink}
        markerEnd="url(#cota-seta)"
      />
      <text x="214" y="128" className={styles.label}>
        θ
      </text>

      {/* cota L: comprimento da lança, paralela a ela */}
      <path
        d="M150 131 L304 10"
        className={styles.dim}
        markerStart="url(#cota-seta)"
        markerEnd="url(#cota-seta)"
      />
      <text x="214" y="62" className={styles.label}>
        L
      </text>

      {/* cota R: raio de trabalho, do eixo de giro à vertical do gancho */}
      <path d="M318 186 V238" className={styles.thin} />
      <path
        d="M146 230 H318"
        className={styles.dim}
        markerStart="url(#cota-seta)"
        markerEnd="url(#cota-seta)"
      />
      <rect x="220" y="221" width="24" height="16" className={styles.paper} />
      <text x="232" y="233" className={styles.label} textAnchor="middle">
        R
      </text>

      {/* chamadas */}
      <text x="352" y="170" className={styles.note}>
        carga
      </text>
      <text x="152" y="92" className={styles.note} textAnchor="middle">
        eixo de giro
      </text>
    </svg>
  )
}
