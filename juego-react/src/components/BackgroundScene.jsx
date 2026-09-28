import React, { useMemo } from 'react';

export default function BackgroundScene({ isLogin, hasOverlay }) {
  // Generar las estrellas de fondo una sola vez
  const estrellas = useMemo(() => {
    let s = 7;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const items = [];
    for (let i = 0; i < 45; i++) {
      items.push({
        cx: (rnd() * 400).toFixed(1),
        cy: (rnd() * 330).toFixed(1),
        r: (0.6 + rnd() * 1.4).toFixed(1),
        opacity: (0.3 + rnd() * 0.7).toFixed(2)
      });
    }
    return items;
  }, []);

  // Generar edificios y ventanas de Pasto
  const { edificios, ventanas } = useMemo(() => {
    let s = 11;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const edifs = [];
    const vents = [];
    let x = 0;
    while (x < 400) {
      const w = 22 + rnd() * 30;
      const alto = 50 + rnd() * 120;
      if (x + w > 168 && x < 232) {
        x = 232;
        continue;
      }
      const y = 592 - alto;
      edifs.push({
        x: x.toFixed(1),
        y: y.toFixed(1),
        w: w.toFixed(1),
        h: alto.toFixed(1)
      });

      for (let wy = y + 8; wy < 582; wy += 14) {
        for (let wx = x + 5; wx < x + w - 6; wx += 10) {
          const on = rnd() < 0.3;
          vents.push({
            x: wx.toFixed(1),
            y: wy.toFixed(1),
            fill: on ? '#FFD66B' : '#1C1438',
            parpadeo: on && rnd() < 0.35,
            delay: (rnd() * 3).toFixed(1)
          });
        }
      }
      x += w + 3;
    }
    return { edificios: edifs, ventanas: vents };
  }, []);

  // Generar pinos
  const pinosAtras = [
    [18, 604, 46],
    [60, 596, 38],
    [110, 594, 52],
    [300, 590, 44],
    [350, 596, 56],
    [392, 590, 40]
  ];

  const pinosFrente = [
    [10, 676, 70],
    [52, 668, 54],
    [90, 662, 40],
    [318, 660, 48],
    [362, 664, 74],
    [398, 656, 52]
  ];

  const luces = useMemo(() => {
    let s = 19;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const arr = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        cx: (rnd() * 400).toFixed(0),
        cy: (600 + rnd() * 180).toFixed(0),
        r: (1.8 + rnd() * 1.6).toFixed(1),
        delay: (rnd() * 4).toFixed(1),
        dur: (3 + rnd() * 3).toFixed(1)
      });
    }
    return arr;
  }, []);

  if (isLogin) {
    return (
      <div className="capa-fondo" id="fondo-login">
        <div className="franja" />
      </div>
    );
  }

  return (
    <div className={`capa-fondo ${hasOverlay ? 'escena-overlay' : ''}`} id="escena">
      <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#120D2E" />
            <stop offset=".42" stopColor="#3A2262" />
            <stop offset=".66" stopColor="#9C4E78" />
            <stop offset=".8" stopColor="#EE8F5A" />
          </linearGradient>
          <radialGradient id="halo">
            <stop offset="0" stopColor="#FFF1C9" stopOpacity=".9" />
            <stop offset="1" stopColor="#FFE39A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="aura">
            <stop offset="0" stopColor="#B266FF" stopOpacity=".55" />
            <stop offset="1" stopColor="#B266FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="400" height="800" fill="url(#cielo)" />

        {/* Estrellas */}
        <g id="estrellas" fill="#FFF4E0">
          {estrellas.map((st, i) => (
            <circle key={i} cx={st.cx} cy={st.cy} r={st.r} opacity={st.opacity} />
          ))}
        </g>

        {/* Luna */}
        <circle cx="316" cy="118" r="74" fill="url(#halo)" />
        <circle cx="316" cy="118" r="26" fill="#FFF1C9" />
        <circle cx="306" cy="110" r="5" fill="#F1DDA8" />
        <circle cx="324" cy="128" r="4" fill="#F1DDA8" />

        {/* Aura del nodo */}
        <circle cx="200" cy="360" r="120" fill="url(#aura)" />

        {/* Volcán Galeras */}
        <path
          d="M-60 612 C 10 570, 80 478, 132 448 L 150 454 L 164 444 L 182 452 C 236 476, 320 552, 420 612 Z"
          fill="#3A2458"
        />
        <path d="M132 448 L 150 454 L 164 444 L 182 452 L 176 462 L 150 466 Z" fill="#2A1A45" />

        {/* Humo del Galeras */}
        <g className="humo" fill="#D9CCFF">
          <ellipse cx="160" cy="432" rx="9" ry="5" opacity=".45" />
          <ellipse cx="153" cy="418" rx="13" ry="6" opacity=".35" />
          <ellipse cx="143" cy="402" rx="17" ry="7" opacity=".25" />
        </g>

        {/* Ciudad de Pasto */}
        <g id="ciudad">
          {edificios.map((ed, i) => (
            <rect key={'e-' + i} x={ed.x} y={ed.y} width={ed.w} height={ed.h} fill="#2A1E50" />
          ))}
          {ventanas.map((v, i) => (
            <rect
              key={'v-' + i}
              x={v.x}
              y={v.y}
              width="5"
              height="7"
              fill={v.fill}
              className={v.parpadeo ? 'parpadeo' : undefined}
              style={v.parpadeo ? { animationDelay: `${v.delay}s` } : undefined}
            />
          ))}
        </g>

        {/* Torre del nodo principal */}
        <rect x="174" y="352" width="52" height="240" fill="#221743" />
        <rect x="186" y="330" width="28" height="24" fill="#221743" />
        <line x1="200" y1="330" x2="200" y2="296" stroke="#221743" strokeWidth="4" />
        <circle cx="200" cy="294" r="4" fill="#FF5C5C" className="parpadeo" />
        <rect x="183" y="372" width="30" height="16" rx="3" fill="none" stroke="#FF5C5C" strokeWidth="3" />
        <rect x="213" y="377" width="4" height="6" fill="#FF5C5C" />
        <rect x="186" y="375" width="7" height="10" fill="#FF5C5C" className="parpadeo" />

        {/* Niebla del Drenador */}
        <path
          className="niebla"
          d="M-60 560 C 20 520, 100 585, 190 548 S 350 515, 460 560 L460 610 L-60 610Z"
          fill="#8A4FD0"
          opacity=".3"
        />
        <path
          className="niebla"
          style={{ animationDuration: '18s', animationDirection: 'alternate-reverse' }}
          d="M-60 585 C 40 555, 150 600, 240 572 S 380 560, 460 590 L460 620 L-60 620Z"
          fill="#6D35B0"
          opacity=".3"
        />

        {/* Colinas y Pinos */}
        <path d="M0 600 Q 90 560 200 588 T 400 576 V800 H0Z" fill="#2B5A3C" />
        <g id="pinos-atras" fill="#1F4A2E">
          {pinosAtras.map(([cx, base, al], i) => (
            <polygon
              key={'pa-' + i}
              points={`${cx},${base - al} ${cx - al * 0.36},${base} ${cx + al * 0.36},${base}`}
            />
          ))}
        </g>

        <path d="M0 668 Q 130 620 250 652 T 400 640 V800 H0Z" fill="#1C4029" />
        <g id="pinos" fill="#153322">
          {pinosFrente.map(([cx, base, al], i) => (
            <polygon
              key={'pf-' + i}
              points={`${cx},${base - al} ${cx - al * 0.36},${base} ${cx + al * 0.36},${base}`}
            />
          ))}
        </g>

        <path d="M0 740 Q 120 712 220 734 T 400 728 V800 H0Z" fill="#12301F" />

        {/* Luces de la montaña */}
        <g id="luces" fill="#FFE36E">
          {luces.map((l, i) => (
            <circle
              key={'l-' + i}
              className="luz"
              cx={l.cx}
              cy={l.cy}
              r={l.r}
              style={{ animationDelay: `${l.delay}s`, animationDuration: `${l.dur}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
