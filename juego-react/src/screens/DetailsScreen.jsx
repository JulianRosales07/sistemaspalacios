import React, { useEffect, useRef } from 'react';
import WoodButton from '../components/WoodButton';

export default function DetailsScreen({ onBackToMenu }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <section className="pantalla pantalla-panel" id="p-detalles" ref={sectionRef}>
      <div className="panel">
        <div className="tabla panel-cab t-naranja">Detalles</div>
        <h2>¿Por qué este juego?</h2>
        <p>
          Batería al 100 hace parte de la Semana de Seguridad y Salud en el Trabajo de Sistemas
          Palacios. Queremos hablar de riesgo psicosocial de una forma distinta: jugando, en vez de
          con otra charla o un formulario.
        </p>
        <p>
          La historia pasa en Pasto y en nuestro propio trabajo: el cierre de mes en la sede, el
          Centro de Operaciones que vigila la red de Nariño y el celular que suena en casa después
          de las 6. Cada capítulo empieza con un tutorial corto para practicar sin perder batería
          ni puntos.
        </p>
        <h3>¿Qué es el riesgo psicosocial?</h3>
        <p>
          Son las condiciones del trabajo que pueden afectar tu salud física y mental: la carga
          excesiva, el trato entre compañeros, el estilo de liderazgo, la falta de pausas o la
          dificultad para desconectarte. En Colombia las empresas deben identificarlo y gestionarlo
          (Resolución 2646 de 2008).
        </p>
        <h3>¿Qué vas a practicar?</h3>
        <p>
          <b>La sede:</b> priorizar, decir que no a la sobrecarga y tomar pausas.
        </p>
        <p>
          <b>Centro de Operaciones:</b> frenar el maltrato, no repetir rumores y apoyar a quien lo
          necesita. El acoso laboral está regulado por la Ley 1010 de 2006.
        </p>
        <p>
          <b>La casa:</b> desconectarte después de la jornada. Es un derecho reconocido por la Ley
          2191 de 2022.
        </p>
        <p>
          <b>El Drenador:</b> usar todo lo aprendido al mismo tiempo.
        </p>
        <h3>¿Qué beneficios trae?</h3>
        <p>
          Te ayuda a reconocer las señales de estrés antes de que se vuelvan agotamiento, a
          practicar respuestas sanas como poner límites, pedir apoyo y pausar, y a recordar las
          rutas de ayuda: Talento Humano, el área de SST y el Comité de Convivencia Laboral. Un
          equipo que se cuida trabaja mejor y convive mejor.
        </p>
        <h3>La traba</h3>
        <p>
          Tu batería no se recarga del todo entre capítulos, igual que en la vida real: el
          cansancio se acumula. Además, el Drenador disfraza sus trampas de cosas buenas, como horas
          extra sin fin, un correo "rapidito" en la noche o un chisme que parece conversación.
          Todas brillan de color morado. Aprender a reconocerlas es la clave para ganar.
        </p>
        <h3>Dificultad y ranking</h3>
        <p>
          Antes de empezar la aventura eliges la dificultad: Fácil, Media o Difícil. Los puntos se
          multiplican según el nivel (x1, x1,5 y x2), así que todos compiten en el mismo ranking.
          Al terminar la semana, gana el mayor puntaje registrado.
        </p>
        <p>
          En el botón Ranking puedes ver a los mejores jugadores y la tabla por departamentos. Los
          departamentos se ordenan por el promedio del mejor puntaje de cada participante, para que
          compitan igual las áreas grandes y las pequeñas.
        </p>
        <h3>⚡ Regla de oportunidad única</h3>
        <p>
          Para asegurar una competencia limpia, transparente y en completa igualdad de condiciones
          para todos los colaboradores de Sistemas Palacios, <b>cada participante cuenta con una sola
          oportunidad</b> para jugar. Una vez finalizada tu aventura, tu puntaje quedará guardado
          de forma definitiva en el ranking oficial y no habrá segundas oportunidades ni reintentos.
        </p>

        <h3>Tu información</h3>
        <p>
          El juego solo guarda tu cédula, tu puntaje y tu avance. No mide ni guarda nada sobre tu
          salud.
        </p>
      </div>

      <div className="acciones">
        <WoodButton color="t-rojo" chica onClick={onBackToMenu}>
          Volver
        </WoodButton>
      </div>
    </section>
  );
}
