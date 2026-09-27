/** Marca do produto: silhueta de guindaste com lança e cabo, em traço (decorativa). */
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
      <defs>
        <linearGradient id="brand-gradient" x1="0" y1="32" x2="32" y2="0">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="#0d1219"
        stroke="url(#brand-gradient)"
      />
      {/* base e torre */}
      <path d="M7 25h11" stroke="#a8b5c6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 25v-5h5v5" stroke="#a8b5c6" strokeWidth="1.6" strokeLinejoin="round" />
      {/* lança */}
      <path
        d="M12.5 20 25 8"
        stroke="url(#brand-gradient)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* cabo e gancho */}
      <path d="M25 8v9" stroke="#67e8f9" strokeWidth="1.2" strokeDasharray="1.6 1.4" />
      <rect x="22.5" y="17.5" width="5" height="4" rx="0.8" fill="#22d3ee" />
    </svg>
  )
}
