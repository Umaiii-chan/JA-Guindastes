import styles from './HeroIllustration.module.css'

/**
 * Ilustração decorativa do Início: guindaste em traço sobre a grade técnica, com o anel do raio de
 * trabalho e a carga pendurada. Só SVG, sem dados.
 */
export function HeroIllustration() {
  return (
    <svg className={styles.art} viewBox="0 0 420 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="hero-boom" x1="120" y1="210" x2="330" y2="60">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="50%" cy="72%" r="55%">
          <stop offset="0%" stopColor="rgb(34 211 238 / 0.22)" />
          <stop offset="100%" stopColor="rgb(34 211 238 / 0)" />
        </radialGradient>
        <pattern id="hero-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" stroke="rgb(148 178 214 / 0.08)" strokeWidth="1" />
        </pattern>
        <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="45%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.2" />
        </linearGradient>
        <mask id="hero-mask">
          <rect width="420" height="300" fill="url(#hero-fade)" />
        </mask>
      </defs>

      <rect width="420" height="300" fill="url(#hero-glow)" />
      <g mask="url(#hero-mask)">
        <rect width="420" height="300" fill="url(#hero-grid)" />
      </g>

      {/* chão em perspectiva e anel do raio de trabalho */}
      <ellipse cx="150" cy="232" rx="190" ry="44" stroke="rgb(148 178 214 / 0.12)" />
      <ellipse
        className={styles.ring}
        cx="150"
        cy="232"
        rx="168"
        ry="38"
        stroke="#34d399"
        strokeWidth="1.6"
        strokeDasharray="6 6"
      />
      <path d="M150 232 L318 232" stroke="#34d399" strokeWidth="1" strokeDasharray="2 4" />
      <text x="232" y="226" className={styles.label}>
        R = 16,8 m
      </text>

      {/* chassi e torre */}
      <rect x="92" y="206" width="116" height="20" rx="4" fill="#16202b" stroke="#253343" />
      <circle cx="112" cy="228" r="8" fill="#0d1219" stroke="#34465a" />
      <circle cx="188" cy="228" r="8" fill="#0d1219" stroke="#34465a" />
      <path d="M126 206 L126 184 L170 184 L178 206 Z" fill="#1d2936" stroke="#34465a" />
      <rect x="134" y="189" width="18" height="11" rx="2" fill="rgb(34 211 238 / 0.25)" />

      {/* lança */}
      <path
        className={styles.boom}
        d="M150 190 L328 64"
        stroke="url(#hero-boom)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M150 190 L328 64"
        stroke="rgb(3 27 33 / 0.6)"
        strokeWidth="1.4"
        strokeDasharray="10 8"
      />
      <circle cx="150" cy="190" r="6" fill="#0d1219" stroke="#67e8f9" strokeWidth="2" />

      {/* cabo e carga */}
      <path className={styles.cable} d="M328 64 L328 176" stroke="#a8b5c6" strokeWidth="1.2" />
      <g className={styles.load}>
        <path d="M328 176 l-7 8 h14 z" fill="#a8b5c6" />
        <rect
          x="306"
          y="184"
          width="44"
          height="30"
          rx="3"
          fill="#16202b"
          stroke="#34d399"
          strokeWidth="1.5"
        />
        <path d="M306 199 H350" stroke="rgb(52 211 153 / 0.35)" />
      </g>

      {/* ângulo da lança */}
      <path d="M186 190 A36 36 0 0 0 179 169" stroke="#fbbf24" strokeWidth="1.4" />
      <text x="192" y="178" className={styles.labelWarm}>
        θ 35°
      </text>
    </svg>
  )
}
