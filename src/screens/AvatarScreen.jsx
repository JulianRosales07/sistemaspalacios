import React, { useState, useRef, useEffect } from 'react';
import WoodButton from '../components/WoodButton';
import {
  TONOS_PIEL,
  COLORES_PELO,
  ESTILOS_PELO,
  ACCESORIOS,
  drawPixelAvatar,
  avatarPorDefecto
} from '../game/pixelAvatar';
import { sfx } from '../game/audio';

export default function AvatarScreen({ profile, onSaveAvatar, onBack, esInicial = false, onLogout }) {
  const [config, setConfig] = useState(() => ({
    ...(profile?.avatar || avatarPorDefecto())
  }));

  const [tab, setTab] = useState('piel'); // 'piel' | 'cabello' | 'color' | 'accesorio'
  const [posturaPreview, setPosturaPreview] = useState('parado'); // 'parado' | 'canasta' | 'sentado' | 'sofa' | 'combate'
  const [animoPreview, setAnimoPreview] = useState('feliz'); // 'feliz' | 'normal' | 'cansado'
  const [guardadoMsg, setGuardadoMsg] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const canvasRef = useRef(null);
  const haModificadoRef = useRef(false);

  // Sincronizar si profile.avatar se descarga desde Supabase tras montar
  useEffect(() => {
    if (!haModificadoRef.current && profile?.avatar) {
      setConfig(prev => ({ ...prev, ...profile.avatar }));
    }
  }, [profile?.avatar]);

  // Animación en vivo en el Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let animId;
    let tiempo = 0;

    const render = () => {
      tiempo += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fondo sutil del avatar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
      ctx.fill();

      // Dibujar avatar centrado con escala amplia
      const scale = posturaPreview === 'canasta' ? 3.4 : 4.2;
      const posY = posturaPreview === 'canasta' ? canvas.height * 0.72 : canvas.height * 0.65;

      drawPixelAvatar(ctx, canvas.width / 2, posY, {
        avatar: config,
        scale,
        postura: posturaPreview,
        animo: animoPreview,
        tiempo,
        anchoCanasta: 90,
        mostrarAura: posturaPreview === 'combate'
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [config, posturaPreview, animoPreview]);

  const handleGuardar = () => {
    if (guardando) return;
    setGuardando(true);
    sfx.bien();
    setGuardadoMsg(true);
    onSaveAvatar(config);
    setTimeout(() => {
      onBack();
    }, 450);
  };

  return (
    <section className="pantalla pantalla-panel" id="p-avatar">
      <div className="panel" style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
        <div className="tabla panel-cab t-verde">
          {esInicial ? 'Crea tu Avatar' : 'Personalizar Avatar'}
        </div>

        <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: 'var(--crema-suave)' }}>
          {esInicial
            ? '¡Bienvenido! Antes de comenzar a jugar, personaliza tu personaje oficial de Sistemas Palacios.'
            : 'Crea tu personaje oficial de Sistemas Palacios para los 4 capítulos.'}
        </p>

        {/* Sección Visual: Canvas + Controles de Vista Previa */}
        <div className="avatar-preview-container">
          <div className="avatar-canvas-wrapper">
            <canvas
              ref={canvasRef}
              width={200}
              height={200}
              className="avatar-live-canvas"
            />
          </div>

          <div className="avatar-posturas-selector">
            <span style={{ fontSize: '0.78rem', color: 'var(--crema-suave)', display: 'block', marginBottom: '4px' }}>
              Ver en postura:
            </span>
            <div className="posturas-botones">
              <button
                type="button"
                className={`btn-postura ${posturaPreview === 'parado' ? 'activa' : ''}`}
                onClick={() => setPosturaPreview('parado')}
                title="Reposo / Perfil"
              >
                🧍 Reposo
              </button>
              <button
                type="button"
                className={`btn-postura ${posturaPreview === 'canasta' ? 'activa' : ''}`}
                onClick={() => setPosturaPreview('canasta')}
                title="Capítulo 1: Con canasta"
              >
                🧺 Cap. 1
              </button>
              <button
                type="button"
                className={`btn-postura ${posturaPreview === 'sentado' ? 'activa' : ''}`}
                onClick={() => setPosturaPreview('sentado')}
                title="Capítulo 2: En puesto de trabajo"
              >
                💻 Cap. 2
              </button>
              <button
                type="button"
                className={`btn-postura ${posturaPreview === 'sofa' ? 'activa' : ''}`}
                onClick={() => setPosturaPreview('sofa')}
                title="Capítulo 3: En el sofá de casa"
              >
                🛋️ Cap. 3
              </button>
              <button
                type="button"
                className={`btn-postura ${posturaPreview === 'combate' ? 'activa' : ''}`}
                onClick={() => setPosturaPreview('combate')}
                title="Capítulo 4: Batalla final"
              >
                ⚡ Cap. 4
              </button>
            </div>
          </div>
        </div>

        {/* Banner de Ropa Oficial Bloqueada */}
        <div className="avatar-uniforme-badge">
          <span style={{ fontWeight: 800 }}>👔 Uniforme Obligatorio:</span>
          <span>
            🔴 Chaqueta Roja &bull; 👖 Jeans Azul &bull; 👟 Zapatos Negros
          </span>
        </div>

        {/* Pestañas de Personalización */}
        <div className="avatar-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'piel' ? 'activo' : ''}`}
            onClick={() => { sfx.clic(); setTab('piel'); }}
          >
            🎨 Piel
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'cabello' ? 'activo' : ''}`}
            onClick={() => { sfx.clic(); setTab('cabello'); }}
          >
            ✂️ Peinado
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'color' ? 'activo' : ''}`}
            onClick={() => { sfx.clic(); setTab('color'); }}
          >
            🌈 Color Pelo
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'accesorio' ? 'activo' : ''}`}
            onClick={() => { sfx.clic(); setTab('accesorio'); }}
          >
            🎧 Accesorios
          </button>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="avatar-tab-content">
          {tab === 'piel' && (
            <div className="opciones-grid">
              {TONOS_PIEL.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn-opcion-swatch ${config.pielId === t.id ? 'seleccionado' : ''}`}
                  onClick={() => {
                    sfx.clic();
                    setConfig(prev => ({ ...prev, pielId: t.id }));
                  }}
                >
                  <span
                    className="swatch-circulo"
                    style={{ backgroundColor: t.piel, border: `2px solid ${t.sombra}` }}
                  />
                  <span>{t.nombre}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'cabello' && (
            <div className="opciones-grid">
              {ESTILOS_PELO.map(e => (
                <button
                  key={e.id}
                  type="button"
                  className={`btn-opcion-texto ${config.peloId === e.id ? 'seleccionado' : ''}`}
                  onClick={() => {
                    sfx.clic();
                    setConfig(prev => ({ ...prev, peloId: e.id }));
                  }}
                >
                  {e.nombre}
                </button>
              ))}
            </div>
          )}

          {tab === 'color' && (
            <div className="opciones-grid">
              {COLORES_PELO.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn-opcion-swatch ${config.colorPeloId === c.id ? 'seleccionado' : ''}`}
                  onClick={() => {
                    sfx.clic();
                    setConfig(prev => ({ ...prev, colorPeloId: c.id }));
                  }}
                >
                  <span
                    className="swatch-circulo"
                    style={{ backgroundColor: c.color, border: `2px solid ${c.sombra}` }}
                  />
                  <span>{c.nombre}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'accesorio' && (
            <div className="opciones-grid">
              {ACCESORIOS.map(a => (
                <button
                  key={a.id}
                  type="button"
                  className={`btn-opcion-texto ${config.accesorioId === a.id ? 'seleccionado' : ''}`}
                  onClick={() => {
                    sfx.clic();
                    setConfig(prev => ({ ...prev, accesorioId: a.id }));
                  }}
                >
                  {a.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {guardadoMsg && (
          <p style={{ color: 'var(--verde)', fontWeight: 800, margin: '8px 0' }}>
            ✓ ¡Avatar guardado exitosamente!
          </p>
        )}
      </div>

      {/* Botones de Acción de la pantalla */}
      <div className="acciones" style={{ marginTop: '16px' }}>
        <WoodButton color="t-verde" onClick={handleGuardar} disabled={guardando}>
          {esInicial ? 'GUARDAR Y EMPEZAR 🎮' : 'GUARDAR AVATAR'}
        </WoodButton>
        {esInicial ? (
          onLogout && (
            <WoodButton color="t-rojo" chica onClick={onLogout}>
              SALIR
            </WoodButton>
          )
        ) : (
          <WoodButton color="t-rojo" chica onClick={onBack}>
            VOLVER
          </WoodButton>
        )}
      </div>
    </section>
  );
}
