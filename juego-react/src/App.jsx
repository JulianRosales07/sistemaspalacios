import React, { useState, useEffect, useCallback } from 'react';
import BackgroundScene from './components/BackgroundScene';
import StoryModal from './components/StoryModal';
import AlreadyPlayedModal from './components/AlreadyPlayedModal';
import LoginScreen from './screens/LoginScreen';
import MenuScreen from './screens/MenuScreen';
import MapScreen from './screens/MapScreen';
import IntroScreen from './screens/IntroScreen';
import GameScreen from './screens/GameScreen';
import SummaryScreen from './screens/SummaryScreen';
import EndScreen from './screens/EndScreen';
import ProfileScreen from './screens/ProfileScreen';
import RankingScreen from './screens/RankingScreen';
import DetailsScreen from './screens/DetailsScreen';
import AvatarScreen from './screens/AvatarScreen';

import {
  HIST_INTRO,
  HIST_VICTORIA,
  HIST_ESCAPO,
  CAPS_META,
  DIFS
} from './game/constants';
import {
  getSesion,
  setSesion,
  cargarPerfil,
  guardarPerfil,
  getRunActual,
  getInsigniasGanadas,
  guardarLocalRanking,
  haJugado
} from './game/storage';
import { guardarPartida, cargarPerfilServidor, sincronizarPerfilServidor } from './game/api';
import { getSonido, toggleSonido, sfx } from './game/audio';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [session, setSessionState] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(getSonido());
  const [showAlreadyPlayedModal, setShowAlreadyPlayedModal] = useState(false);

  // Estado para la pantalla de historia (viñetas de diálogo)
  const [storyConfig, setStoryConfig] = useState(null);

  // Estado del capítulo seleccionado
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [withTutorial, setWithTutorial] = useState(true);

  // Estado de fin de capítulo (resumen)
  const [summaryData, setSummaryData] = useState(null);

  // Estado de fin de la aventura
  const [saveStatus, setSaveStatus] = useState('');

  // Cargar sesión inicial al montar
  useEffect(() => {
    const s = getSesion();
    if (s && s.cedula) {
      setSessionState(s);
      const p = cargarPerfil(s.cedula);
      setProfileState(p);
      if (!p.configuroAvatar) {
        setScreen('avatar');
      } else {
        setScreen('menu');
      }

      // Sincronizar desde Supabase directamente
      cargarPerfilServidor(s.cedula, s.token).then(servidorPerfil => {
        if (servidorPerfil) {
          setProfileState(servidorPerfil);
          guardarPerfil(s.cedula, servidorPerfil);
          if (!servidorPerfil.configuroAvatar) {
            setScreen('avatar');
          }
        }
      });
    } else {
      setScreen('login');
    }
  }, []);

  // Actualizar perfil
  const updateProfile = useCallback((newProfile) => {
    setProfileState(newProfile);
    if (session?.cedula) {
      guardarPerfil(session.cedula, newProfile);
      sincronizarPerfilServidor(session.cedula, newProfile, session.token);
    }
  }, [session]);

  // Manejo de sonido
  const handleToggleSound = useCallback(() => {
    const nuevo = toggleSonido();
    setSoundEnabled(nuevo);
  }, []);

  // Login exitoso: si no ha configurado avatar, configurar primero
  const handleLoginSuccess = useCallback(async (ses) => {
    setSesion(ses);
    setSessionState(ses);
    const p = cargarPerfil(ses.cedula);
    setProfileState(p);

    if (!p.configuroAvatar) {
      setScreen('avatar');
    } else {
      setScreen('menu');
    }

    // Sincronizar inmediatamente desde Supabase
    const servidorPerfil = await cargarPerfilServidor(ses.cedula, ses.token);
    if (servidorPerfil) {
      setProfileState(servidorPerfil);
      guardarPerfil(ses.cedula, servidorPerfil);
      if (!servidorPerfil.configuroAvatar) {
        setScreen('avatar');
      }
    }
  }, []);

  // Abrir perfil con recarga fresca desde la base de datos
  const handleOpenProfile = useCallback(async () => {
    setScreen('perfil');
    if (session?.cedula) {
      const servidorPerfil = await cargarPerfilServidor(session.cedula, session.token);
      if (servidorPerfil) {
        setProfileState(servidorPerfil);
        guardarPerfil(session.cedula, servidorPerfil);
      }
    }
  }, [session]);

  // Logout
  const handleLogout = useCallback(() => {
    setSesion(null);
    setSessionState(null);
    setProfileState(null);
    setScreen('login');
  }, []);

  // Proteger pantallas de juego: si ya jugó, volver siempre al menú
  useEffect(() => {
    if (haJugado(profile) && (screen === 'mapa' || screen === 'juego' || screen === 'intro')) {
      setScreen('menu');
    }
  }, [screen, profile]);

  // Asegurar siempre que al cambiar de pantalla se muestre desde el inicio (arriba)
  useEffect(() => {
    window.scrollTo(0, 0);
    const resetScroll = () => {
      document.querySelectorAll('.pantalla, .pantalla-panel, .panel').forEach(el => {
        el.scrollTop = 0;
      });
    };
    resetScroll();
    const t = setTimeout(resetScroll, 30);
    return () => clearTimeout(t);
  }, [screen]);

  // Mostrar historia modal
  const showStory = useCallback((panels, onFinish, finalButtonText = 'Continuar') => {
    setStoryConfig({
      panels,
      onFinish: () => {
        setStoryConfig(null);
        if (onFinish) onFinish();
      },
      finalButtonText
    });
    setScreen('historia');
  }, []);

  // Menú -> Jugar (solo 1 oportunidad)
  const handlePlayFromMenu = useCallback(() => {
    if (!profile) return;
    if (!profile.configuroAvatar) {
      setScreen('avatar');
      return;
    }
    if (haJugado(profile)) {
      setShowAlreadyPlayedModal(true);
      sfx.mal();
      return;
    }
    if (!profile.vioIntro) {
      showStory(
        HIST_INTRO,
        () => {
          const updated = { ...profile, vioIntro: true };
          updateProfile(updated);
          setScreen('mapa');
        },
        'Comenzar aventura'
      );
    } else {
      setScreen('mapa');
    }
  }, [profile, showStory, updateProfile]);

  // Cambiar dificultad en el mapa
  const handleSelectDifficulty = useCallback((difKey) => {
    if (!profile) return;
    const run = getRunActual(profile);
    run.dif = difKey;
    const updated = { ...profile, difPref: difKey, run };
    updateProfile(updated);
  }, [profile, updateProfile]);

  // Reiniciar aventura
  const handleRestartAdventure = useCallback(() => {
    if (!profile) return;
    const updated = { ...profile, run: null };
    updateProfile(updated);
    sfx.clic();
  }, [profile, updateProfile]);

  // Seleccionar parada de capítulo en el mapa
  const handleSelectChapter = useCallback((chapterIndex) => {
    setSelectedChapter(chapterIndex);
    const meta = CAPS_META[chapterIndex];

    showStory(
      meta.historia,
      () => {
        setScreen('intro');
      },
      'Continuar'
    );
  }, [showStory]);

  // Iniciar capítulo desde Intro
  const handleStartChapter = useCallback((chapterIndex, conTuto) => {
    setSelectedChapter(chapterIndex);
    setWithTutorial(conTuto);
    setScreen('juego');
  }, []);

  // Fin de la aventura completa (tras el capítulo 4)
  const finishAdventure = useCallback(async (finalRun) => {
    const ac = finalRun.resultados.reduce((a, r) => a + (r.aciertos || 0), 0);
    const er = finalRun.resultados.reduce((a, r) => a + (r.errores || 0), 0);
    const pct = ac + er ? ac / (ac + er) : 0;

    setScreen('fin');
    setSaveStatus('Registrando tu puntaje en la base de datos…');

    // Registrar en Supabase
    const payload = {
      cedula: session.cedula,
      nombre: session.nombre,
      area: session.area || '',
      dificultad: finalRun.dif,
      puntaje: finalRun.puntos,
      porcentaje_aciertos: Math.round(pct * 100),
      vencio_drenador: finalRun.victoria,
      capitulos: finalRun.resultados,
      avatar: profile?.avatar || null
    };

    const res = await guardarPartida(payload, session.token);
    setSaveStatus(res.msg);

    // Actualizar perfil local y sincronizar con base de datos
    const nuevoMejor = res.ok ? Math.max(profile?.mejor || 0, finalRun.puntos) : (profile?.mejor || 0);
    const updated = {
      ...profile,
      partidas: 1,
      yaJugo: true,
      mejor: nuevoMejor,
      capMax: 4,
      drenador: finalRun.victoria || profile?.drenador,
      run: null
    };
    updateProfile(updated);

    // Guardar en ranking local para fallback offline
    const dRun = DIFS[finalRun.dif] || DIFS.media;
    guardarLocalRanking({
      cedula: session.cedula,
      nombre: session.nombre,
      area: session.area || '',
      puntos: nuevoMejor,
      dificultad: dRun.nombre
    });

    // Sincronizar contadores e insignias con la tabla jugador en Supabase
    sincronizarPerfilServidor(session.cedula, updated, session.token);

    // Recargar perfil validado desde el servidor
    if (res.ok) {
      const servidorPerfil = await cargarPerfilServidor(session.cedula, session.token);
      if (servidorPerfil) {
        updateProfile(servidorPerfil);
      }
    }
  }, [profile, session, updateProfile]);

  // Fin de capítulo desde el juego
  const handleChapterEnd = useCallback((motivo, stats, gameState) => {
    sfx.fin();
    const curRun = getRunActual(profile);
    const cMeta = CAPS_META[selectedChapter];
    const dif = DIFS[curRun.dif] || DIFS.media;
    const exito = motivo !== 'agotado';

    const base = gameState.puntosNivel;
    const bono = exito ? Math.round(gameState.bateria * 2 * dif.mult) : 0;
    const victoria = motivo === 'victoria' ? Math.round(500 * dif.mult) : 0;
    const total = base + bono + victoria;

    const insigniasAntes = getInsigniasGanadas(profile);

    if (motivo === 'victoria') {
      profile.drenador = true;
    }

    const insigniasDespues = getInsigniasGanadas(profile);

    // Preparar estado del run
    const nextRun = { ...curRun };
    if (exito) {
      nextRun.puntos += total;
      nextRun.resultados = [
        ...nextRun.resultados,
        {
          capitulo: cMeta.nombre,
          puntos: total,
          bateriaFinal: Math.round(gameState.bateria),
          aciertos: stats.buenas,
          errores: stats.malas,
          pausas: stats.pausas,
          resultado: motivo
        }
      ];

      if (selectedChapter < 3) {
        nextRun.cap = selectedChapter + 1;
        const nuevaBat = Math.min(100, Math.round(gameState.bateria) + dif.descanso);
        nextRun.bateria = nuevaBat;
        const updated = {
          ...profile,
          capMax: Math.max(profile.capMax || 0, selectedChapter + 1),
          run: nextRun
        };
        updateProfile(updated);
      } else {
        nextRun.victoria = motivo === 'victoria';
        nextRun.cap = 4;
        const updated = { ...profile, capMax: 4, run: nextRun };
        updateProfile(updated);
      }
    } else {
      nextRun.bateria = dif.reintento;
      const updated = { ...profile, run: nextRun };
      updateProfile(updated);
    }

    setSummaryData({
      chapterIndex: selectedChapter,
      motivo,
      stats,
      gameState: { ...gameState },
      run: nextRun,
      insigniasAntes,
      insigniasDespues
    });

    setScreen('resumen');
  }, [profile, selectedChapter, updateProfile]);

  // Resumen -> Ver el final
  const handleSeeEndingFromSummary = useCallback(() => {
    if (!summaryData) return;
    const { run: finalRun } = summaryData;
    showStory(
      finalRun.victoria ? HIST_VICTORIA : HIST_ESCAPO,
      () => {
        finishAdventure(finalRun);
      },
      'Ver resultados'
    );
  }, [summaryData, showStory, finishAdventure]);

  // Resumen -> Reintentar capítulo
  const handleRetryChapter = useCallback(() => {
    setScreen('intro');
  }, []);

  const currentRun = getRunActual(profile);
  const isLoginScreen = screen === 'login';
  const hasOverlay =
    screen !== 'login' && screen !== 'menu';

  return (
    <>
      {/* Fondo ilustrado */}
      <BackgroundScene isLogin={isLoginScreen} hasOverlay={hasOverlay} />

      <main className="app">
        {screen === 'login' && (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        )}

        {screen === 'menu' && (
          <MenuScreen
            session={session}
            profile={profile}
            onPlay={handlePlayFromMenu}
            onProfile={handleOpenProfile}
            onDetails={() => setScreen('detalles')}
            onRanking={() => setScreen('ranking')}
            onLogout={handleLogout}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
          />
        )}

        {screen === 'historia' && storyConfig && (
          <StoryModal
            panels={storyConfig.panels}
            onFinish={storyConfig.onFinish}
            finalButtonText={storyConfig.finalButtonText}
          />
        )}

        {screen === 'mapa' && (
          <MapScreen
            profile={profile}
            run={currentRun}
            onSelectChapter={handleSelectChapter}
            onSelectDifficulty={handleSelectDifficulty}
            onBackToMenu={() => setScreen('menu')}
          />
        )}

        {screen === 'intro' && (
          <IntroScreen
            chapterIndex={selectedChapter}
            profile={profile}
            onStartChapter={handleStartChapter}
          />
        )}

        {screen === 'juego' && (
          <GameScreen
            chapterIndex={selectedChapter}
            conTutorial={withTutorial}
            profile={profile}
            run={currentRun}
            onChapterEnd={handleChapterEnd}
            onExitToMap={() => setScreen('mapa')}
            onSaveProfile={updateProfile}
          />
        )}

        {screen === 'resumen' && summaryData && (
          <SummaryScreen
            chapterIndex={summaryData.chapterIndex}
            motivo={summaryData.motivo}
            stats={summaryData.stats}
            gameState={summaryData.gameState}
            run={summaryData.run}
            profile={profile}
            insigniasAntes={summaryData.insigniasAntes}
            insigniasDespues={summaryData.insigniasDespues}
            onContinueMap={() => setScreen('mapa')}
            onSeeEnding={handleSeeEndingFromSummary}
            onRetryChapter={handleRetryChapter}
          />
        )}

        {screen === 'fin' && (
          <EndScreen
            run={summaryData?.run || currentRun}
            saveStatus={saveStatus}
            onBackToMenu={() => setScreen('menu')}
          />
        )}

        {screen === 'perfil' && (
          <ProfileScreen
            session={session}
            profile={profile}
            onBackToMenu={() => setScreen('menu')}
            onProfileLoaded={updateProfile}
            onEditAvatar={() => setScreen('avatar')}
          />
        )}

        {screen === 'avatar' && (
          <AvatarScreen
            profile={profile}
            esInicial={!profile?.configuroAvatar}
            onSaveAvatar={(nuevoAvatar) => {
              if (profile) {
                updateProfile({ ...profile, avatar: nuevoAvatar, configuroAvatar: true });
              }
            }}
            onBack={() => {
              setScreen(profile?.configuroAvatar ? 'perfil' : 'menu');
            }}
            onLogout={handleLogout}
          />
        )}

        {screen === 'ranking' && (
          <RankingScreen
            session={session}
            onBackToMenu={() => setScreen('menu')}
          />
        )}

        {screen === 'detalles' && (
          <DetailsScreen onBackToMenu={() => setScreen('menu')} />
        )}

        {showAlreadyPlayedModal && (
          <AlreadyPlayedModal
            session={session}
            profile={profile}
            onClose={() => setShowAlreadyPlayedModal(false)}
            onGoRanking={() => setScreen('ranking')}
            onGoProfile={handleOpenProfile}
          />
        )}
      </main>
    </>
  );
}
