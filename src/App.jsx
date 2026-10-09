import React, { useState, useEffect, useCallback } from 'react';
import BackgroundScene from './components/BackgroundScene';
import StoryModal from './components/StoryModal';
import AlreadyPlayedModal from './components/AlreadyPlayedModal';
import UnavailableModal from './components/UnavailableModal';
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
import AdminScreen from './screens/AdminScreen';

import {
  HIST_INTRO,
  HIST_VICTORIA,
  HIST_ESCAPO,
  CAPS_META,
  DIFS,
  esAdmin
} from './game/constants';
import {
  getSesion,
  setSesion,
  cargarPerfil,
  guardarPerfil,
  getRunActual,
  getInsigniasGanadas,
  guardarLocalRanking,
  haJugado,
  puedeJugar,
  intentosDisponibles
} from './game/storage';
import {
  guardarPartida,
  cargarPerfilServidor,
  sincronizarPerfilServidor,
  obtenerEvento,
  verificarDisponibilidad
} from './game/api';
import { getSonido, toggleSonido, sfx } from './game/audio';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [session, setSessionState] = useState(null);
  const [profile, setProfileState] = useState(null);
  const [evento, setEvento] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(getSonido());
  const [showAlreadyPlayedModal, setShowAlreadyPlayedModal] = useState(false);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [adminTestMode, setAdminTestMode] = useState(false);

  // Estado para la pantalla de historia (viñetas de diálogo)
  const [storyConfig, setStoryConfig] = useState(null);

  // Estado del capítulo seleccionado
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [withTutorial, setWithTutorial] = useState(true);

  // Estado de fin de capítulo (resumen)
  const [summaryData, setSummaryData] = useState(null);

  // Estado de fin de la aventura
  const [saveStatus, setSaveStatus] = useState('');
  const [avatarFrom, setAvatarFrom] = useState('login'); // 'login' | 'perfil'

  // Cargar sesión inicial al montar
  useEffect(() => {
    // Cargar configuración de disponibilidad del evento
    obtenerEvento().then(ev => {
      if (ev) setEvento(ev);
    }).catch(() => {});

    const s = getSesion();
    if (s && s.cedula) {
      setSessionState(s);
      const p = cargarPerfil(s.cedula);
      setProfileState(p);
      if (!p.configuroAvatar) {
        setAvatarFrom('login');
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
            setAvatarFrom('login');
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

  // Login exitoso: siempre pasar primero por el avatar para crear o confirmar antes de jugar
  const handleLoginSuccess = useCallback(async (ses) => {
    setSesion(ses);
    setSessionState(ses);
    const p = cargarPerfil(ses.cedula);
    setProfileState(p);

    // Cargar evento actualizado
    obtenerEvento(ses.token).then(ev => {
      if (ev) setEvento(ev);
    }).catch(() => {});

    // Al iniciar sesión siempre mostramos la pantalla de avatar
    setAvatarFrom('login');
    setScreen('avatar');

    // Sincronizar en segundo plano desde Supabase (si ya tenía avatar o historial guardado)
    cargarPerfilServidor(ses.cedula, ses.token).then(servidorPerfil => {
      if (servidorPerfil) {
        setProfileState(servidorPerfil);
        guardarPerfil(ses.cedula, servidorPerfil);
      }
    }).catch(() => {});
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
    setAdminTestMode(false);
    setScreen('login');
  }, []);

  // Proteger pantallas de juego y de administración: si está cerrado, no debe dejar jugar
  useEffect(() => {
    const esAdminUser = esAdmin(session?.cedula);
    const disp = verificarDisponibilidad(evento);
    const pantallasJuego = screen === 'mapa' || screen === 'juego' || screen === 'intro';

    if (pantallasJuego) {
      if (!puedeJugar(profile)) {
        setScreen('menu');
      } else if (!disp.disponible && !adminTestMode) {
        setScreen('menu');
        setShowUnavailableModal(true);
      }
    }

    if (screen === 'admin' && !esAdminUser) {
      setScreen('menu');
    }
  }, [screen, profile, evento, session?.cedula, adminTestMode]);

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

  // Menú -> Jugar (estrictamente bloqueado si el juego está cerrado)
  const handlePlayFromMenu = useCallback(() => {
    if (!profile) return;
    if (!profile.configuroAvatar) {
      setAvatarFrom('login');
      setScreen('avatar');
      return;
    }

    // Validación estricta: cuando esté cerrado no debe dejar jugar
    const disp = verificarDisponibilidad(evento);
    if (!disp.disponible) {
      setShowUnavailableModal(true);
      sfx.mal();
      return;
    }

    if (!puedeJugar(profile)) {
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
  }, [profile, showStory, updateProfile, evento, session?.cedula]);

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

  // Iniciar segundo intento directamente
  const handlePlaySecondAttempt = useCallback(() => {
    sfx.clic();
    if (!profile) return;
    const freshProfile = { ...profile, run: null };
    updateProfile(freshProfile);
    setSelectedChapter(0);
    setScreen('mapa');
  }, [profile, updateProfile]);

  // Fin de la aventura completa (tras el capítulo 4)
  const finishAdventure = useCallback(async (finalRun) => {
    const ac = finalRun.resultados.reduce((a, r) => a + (r.aciertos || 0), 0);
    const er = finalRun.resultados.reduce((a, r) => a + (r.errores || 0), 0);
    const pct = ac + er ? ac / (ac + er) : 0;

    setScreen('fin');
    setSaveStatus('Registrando tu puntaje en la base de datos…');

    // Registrar en Backend
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
    setSaveStatus(res.msg || (res.ok ? 'Puntaje registrado exitosamente.' : 'No se pudo registrar el puntaje.'));

    const esIntento1 = res.attempt === 1;
    const esIntento2 = res.attempt === 2;
    const intentosUsados = res.attemptsUsed ?? (esIntento1 ? 1 : 2);
    const intentosRestantes = res.attemptsRemaining ?? (2 - intentosUsados);
    const yaJugoFinal = intentosUsados >= 2;

    // REGLA: El rankingScore es EXCLUSIVAMENTE del intento 2 (NUNCA MAX).
    const nuevoRankingScore = esIntento2 ? finalRun.puntos : (profile?.rankingScore ?? null);

    const updated = {
      ...profile,
      partidas: intentosUsados,
      intentosUsados,
      intentosRestantes,
      primerIntentoPuntaje: esIntento1 ? finalRun.puntos : (profile?.primerIntentoPuntaje ?? null),
      segundoIntentoPuntaje: esIntento2 ? finalRun.puntos : (profile?.segundoIntentoPuntaje ?? null),
      rankingScore: nuevoRankingScore,
      mejor: nuevoRankingScore || 0,
      yaJugo: yaJugoFinal,
      capMax: 4,
      drenador: finalRun.victoria || profile?.drenador,
      ultimoIntento: {
        attempt: res.attempt || (esIntento1 ? 1 : 2),
        score: finalRun.puntos,
        countsForRanking: Boolean(res.countsForRanking),
        attemptsUsed,
        attemptsRemaining: intentosRestantes,
        firstAttemptScore: esIntento1 ? finalRun.puntos : (profile?.primerIntentoPuntaje ?? null),
        secondAttemptScore: esIntento2 ? finalRun.puntos : null,
        rankingScore: nuevoRankingScore
      },
      run: null
    };
    updateProfile(updated);

    // Guardar en ranking local para fallback offline ÚNICAMENTE si es el Intento 2
    if (esIntento2) {
      const dRun = DIFS[finalRun.dif] || DIFS.media;
      guardarLocalRanking({
        cedula: session.cedula,
        nombre: session.nombre,
        area: session.area || '',
        puntos: finalRun.puntos, // NUNCA MAX, puntaje exclusivo del 2do intento
        dificultad: dRun.nombre
      });
    }

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
            disponibilidad={verificarDisponibilidad(evento)}
            onPlay={handlePlayFromMenu}
            onProfile={handleOpenProfile}
            onDetails={() => setScreen('detalles')}
            onRanking={() => setScreen('ranking')}
            onLogout={handleLogout}
            onAdmin={() => setScreen('admin')}
            onUnavailableModal={() => setShowUnavailableModal(true)}
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
            profile={profile}
            session={session}
            saveStatus={saveStatus}
            intentoInfo={profile?.ultimoIntento}
            onBackToMenu={() => setScreen('menu')}
            onPlaySecondAttempt={handlePlaySecondAttempt}
            onGoRanking={() => setScreen('ranking')}
          />
        )}

        {screen === 'perfil' && (
          <ProfileScreen
            session={session}
            profile={profile}
            onBackToMenu={() => setScreen('menu')}
            onProfileLoaded={updateProfile}
            onEditAvatar={() => {
              setAvatarFrom('perfil');
              setScreen('avatar');
            }}
          />
        )}

        {screen === 'avatar' && (
          <AvatarScreen
            profile={profile}
            esInicial={avatarFrom === 'login'}
            onSaveAvatar={(nuevoAvatar) => {
              if (profile) {
                updateProfile({ ...profile, avatar: nuevoAvatar, configuroAvatar: true });
              }
            }}
            onBack={() => {
              setScreen(avatarFrom === 'perfil' ? 'perfil' : 'menu');
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

        {screen === 'admin' && (
          <AdminScreen
            session={session}
            onBackToMenu={() => setScreen('menu')}
            onPlayTest={() => {
              if (!profile?.configuroAvatar) {
                setAvatarFrom('login');
                setScreen('avatar');
              } else {
                setScreen('mapa');
              }
            }}
            onViewRanking={() => setScreen('ranking')}
            onEventoUpdated={(nuevo) => setEvento(nuevo)}
          />
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

        {showUnavailableModal && (
          <UnavailableModal
            disponibilidad={verificarDisponibilidad(evento)}
            session={session}
            esAdmin={esAdmin(session?.cedula)}
            onAdmin={() => {
              setShowUnavailableModal(false);
              setScreen('admin');
            }}
            onClose={() => setShowUnavailableModal(false)}
            onGoRanking={() => setScreen('ranking')}
            onGoProfile={handleOpenProfile}
          />
        )}
      </main>
    </>
  );
}
