/**
 * Icônes du parcours d'inscription — tracés repris à l'identique de la maquette.
 * La taille est exprimée en « px de maquette » et suit l'échelle fluide --u
 * définie sur .reg (voir register.css). Hors .reg, 1 unité = 1px.
 */
const dim = (n) => ({
  width: `calc(${n} * var(--u, 1px))`,
  height: `calc(${n} * var(--u, 1px))`,
  flexShrink: 0,
});

function Svg({ size, stroke = 'currentColor', strokeWidth = 2, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      style={dim(size)}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconArrowLeft({ size = 14 }) {
  return (
    <Svg size={size} strokeWidth={2.5}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Svg>
  );
}

export function IconArrowRight({ size = 15 }) {
  return (
    <Svg size={size} stroke="#fff" strokeWidth={2.5}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Svg>
  );
}

export function IconPhone({ size = 24 }) {
  return (
    <Svg size={size}>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </Svg>
  );
}

export function IconLock({ size = 24 }) {
  return (
    <Svg size={size}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export function IconUser({ size = 24 }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </Svg>
  );
}

export function IconCap({ size = 24 }) {
  return (
    <Svg size={size}>
      <path d="M22 9 12 5 2 9l10 4 10-4z" />
      <path d="M6 11v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
    </Svg>
  );
}

/** Cadeau complet (hero, étape 5). */
export function IconGift({ size = 24 }) {
  return (
    <Svg size={size}>
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7S9 2 6.5 3 7 7 12 7s5.5-3.5 5.5-4S15 2 12 7z" />
    </Svg>
  );
}

/** Cadeau simplifié (dans le champ, étape 5). */
export function IconGiftSmall({ size = 16 }) {
  return (
    <Svg size={size}>
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
    </Svg>
  );
}

export function IconEye({ size = 16 }) {
  return (
    <Svg size={size}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff({ size = 16 }) {
  return (
    <Svg size={size}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

export function IconChevronDown({ size = 14 }) {
  return (
    <Svg size={size}>
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

/** Même tracé que la maquette (la ligne de longueur nulle ne se dessine pas). */
export function IconInfo({ size = 14 }) {
  return (
    <Svg size={size} strokeWidth={2.5}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12" y2="16" />
    </Svg>
  );
}

export function IconCheck({ size = 16 }) {
  return (
    <Svg size={size} strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

/** Coche de l'écran de bienvenue (blanche, trait épais, comme la maquette). */
export function IconSuccessCheck({ size = 26 }) {
  return (
    <Svg size={size} stroke="#fff" strokeWidth={3}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

/** Document (page des conditions générales). */
export function IconDoc({ size = 24 }) {
  return (
    <Svg size={size}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Svg>
  );
}

/** Drapeau du Togo en SVG : rendu identique sur tous les appareils (l'emoji varie, et s'affiche « TG » sous Windows). */
export function TogoFlag({ width = 21 }) {
  return (
    <svg
      viewBox="0 0 32 20"
      style={{
        width: `calc(${width} * var(--u, 1px))`,
        height: `calc(${(width * 20) / 32} * var(--u, 1px))`,
        flexShrink: 0,
        borderRadius: 'calc(2 * var(--u, 1px))',
        display: 'block',
      }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="20" fill="#006A4E" />
      <rect y="4" width="32" height="4" fill="#FFCE00" />
      <rect y="12" width="32" height="4" fill="#FFCE00" />
      <rect width="12" height="12" fill="#D21034" />
      <polygon
        fill="#fff"
        points="6,6 6.899,8.762 9.804,8.764 7.455,10.473 8.351,13.236 6,11.53 3.649,13.236 4.545,10.473 2.196,8.764 5.101,8.762"
      />
    </svg>
  );
}
