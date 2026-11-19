/**
 * Decorative wireframe globe with a node network, as on the Kouland poster. It is drawn from a fixed seed,
 * so the server and the browser always render the same picture.
 */
const R = 250;

function buildNetwork(seed: number, count: number) {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;

  const points: Array<{ x: number; y: number; depth: number }> = [];
  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const z = ring * Math.sin(angle);
    if (z < -0.15) continue; // back of the sphere
    points.push({ x: ring * Math.cos(angle) * R, y: u * R, depth: (z + 1) / 2 });
  }

  // Link each node to its two nearest neighbours.
  const links: Array<{ a: number; b: number }> = [];
  points.forEach((p, i) => {
    points
      .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 }))
      .filter(({ j, d }) => j > i && d < 160 * 160)
      .sort((m, n) => m.d - n.d)
      .slice(0, 2)
      .forEach(({ j }) => links.push({ a: i, b: j }));
  });
  return { points, links };
}

const NETWORK = buildNetwork(7, 70);
const MERIDIANS = [1, 2, 3, 4, 5].map((i) => R * Math.cos((i * Math.PI) / 12));
const PARALLELS = [-4, -3, -2, -1, 1, 2, 3, 4].map((i) => {
  const y = R * Math.sin((i * Math.PI) / 10);
  return { y, rx: Math.sqrt(R * R - y * y) };
});

export function NetworkGlobe({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="-320 -320 640 640" aria-hidden="true">
      <defs>
        {/* Colours come from the surrounding platform palette (the parent's red on kouland.com). */}
        <linearGradient id="globe-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--brand-g1))" }} />
          <stop offset="0.5" style={{ stopColor: "rgb(var(--brand-g2))" }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--brand-g3))" }} />
        </linearGradient>
        <radialGradient id="globe-fill">
          <stop offset="0" style={{ stopColor: "rgb(var(--color-brand))", stopOpacity: 0.16 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--color-brand))", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <circle r={R + 40} fill="url(#globe-fill)" />
      <g transform="rotate(-24)" fill="none" stroke="url(#globe-line)" strokeWidth="1">
        <circle r={R} strokeOpacity="0.55" strokeWidth="1.4" />
        <line x1={-R} x2={R} strokeOpacity="0.3" />
        {MERIDIANS.map((rx) => (
          <ellipse key={rx} rx={rx.toFixed(1)} ry={R} strokeOpacity="0.28" />
        ))}
        {PARALLELS.map(({ y, rx }) => (
          <ellipse key={y} cy={y.toFixed(1)} rx={rx.toFixed(1)} ry={(rx * 0.18).toFixed(1)} strokeOpacity="0.22" />
        ))}
      </g>
      <g style={{ stroke: "rgb(var(--color-brand-accent))" }} strokeWidth="1">
        {NETWORK.links.map(({ a, b }) => {
          const p = NETWORK.points[a];
          const q = NETWORK.points[b];
          if (!p || !q) return null;
          return (
            <line key={`${a}-${b}`} x1={p.x.toFixed(1)} y1={p.y.toFixed(1)} x2={q.x.toFixed(1)} y2={q.y.toFixed(1)} strokeOpacity={(0.25 + 0.35 * p.depth).toFixed(2)} />
          );
        })}
      </g>
      <g style={{ fill: "rgb(var(--color-brand-accent))" }}>
        {NETWORK.points.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={(1.6 + 2.2 * p.depth).toFixed(1)} fillOpacity={(0.45 + 0.55 * p.depth).toFixed(2)} />
        ))}
      </g>
    </svg>
  );
}
