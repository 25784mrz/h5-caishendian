const GODS = {
  zhao: { robe: "#161616", face: "#2c2824", hat: "#0e0e0e", beard: "#141414", trim: "#d4b483", mark: "#d4b483" },
  blessing: { robe: "#8c1f1f", face: "#f3d7b0", hat: "#1a1a1a", beard: "#5a3a28", trim: "#e6c07a", mark: "#f3d48a" },
  treasure: { robe: "#a67c2d", face: "#f3d7b0", hat: "#6b1d1d", beard: "#3a2418", trim: "#f3d48a", mark: "#f6e27a" },
  jewel: { robe: "#1d4a68", face: "#f3d7b0", hat: "#102433", beard: "#3a2418", trim: "#d4b483", mark: "#7ec8c3" },
};

export function godFigure(kind = "zhao") {
  const g = GODS[kind] || GODS.zhao;
  const beard = kind === "zhao"
    ? `<path d="M44 56 h32 v18 q-16 16-32 0 z" fill="${g.beard}"/>`
    : `<path d="M50 58 h20 v7 q-10 8-20 0 z" fill="${g.beard}"/>`;
  const prop = kind === "zhao"
    ? `<rect x="96" y="72" width="5" height="46" rx="1" fill="${g.trim}"/>`
    : kind === "treasure"
      ? `<path d="M88 86 h22 l-4 12 h-14 z" fill="${g.mark}" stroke="${g.trim}" stroke-width="1"/>`
      : kind === "jewel"
        ? `<circle cx="100" cy="96" r="8" fill="${g.mark}" stroke="${g.trim}" stroke-width="1"/>`
        : `<rect x="90" y="78" width="14" height="18" rx="1" fill="${g.mark}" stroke="${g.trim}" stroke-width="1"/>`;
  return `<svg class="figure god-figure" viewBox="0 0 120 160" aria-hidden="true">
    <rect x="6" y="6" width="108" height="148" rx="4" fill="#6d5438" stroke="${g.trim}" stroke-width="2"/>
    <rect x="16" y="16" width="88" height="112" fill="#3a241c"/>
    <path d="M32 26 h56 v8 h-10 v8 h-36 v-8 h-10 z" fill="${g.hat}"/>
    <circle cx="60" cy="54" r="14" fill="${g.face}" stroke="#2c2118" stroke-width="1"/>
    <path d="M50 50 h6 v3 h-6 z M64 50 h6 v3 h-6 z" fill="#2c2118"/>
    ${beard}
    <path d="M32 76 h56 v42 h-56 z" fill="${g.robe}" stroke="${g.trim}" stroke-width="1.2"/>
    <rect x="54" y="84" width="12" height="16" fill="${g.trim}"/>
    ${prop}
  </svg>`;
}

export function censerFigure() {
  return `<svg class="figure censer-figure" viewBox="0 0 88 72" aria-hidden="true">
    <path d="M44 18 q-7-14 0-22 q7 8 0 22" fill="none" stroke="#efe6d6" stroke-width="1.6"/>
    <path d="M18 28 h52 q8 12 0 24 h-52 q-8-12 0-24 z" fill="#4a3424" stroke="#d4b483" stroke-width="2"/>
    <rect x="36" y="20" width="16" height="12" rx="1" fill="#2c2118" stroke="#d4b483"/>
    <path d="M28 52 h32 l6 10 h-44 z" fill="#3a241c" stroke="#d4b483" stroke-width="1.2"/>
  </svg>`;
}

function boxFaces() {
  return `<i class="ft"></i><i class="bk"></i><i class="lf"></i><i class="rt"></i><i class="tp"></i><i class="bm"></i>`;
}

export function personFigure() {
  return `<div class="body3d">
    <div class="box head">${boxFaces()}</div>
    <div class="box robe">${boxFaces()}</div>
    <div class="box arm l">${boxFaces()}</div>
    <div class="box arm r">${boxFaces()}</div>
    <div class="box leg l">${boxFaces()}</div>
    <div class="box leg r">${boxFaces()}</div>
  </div>`;
}
