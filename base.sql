-- =====================================================================
--  Batería al 100 — Base de Datos y Ranking para Supabase (PostgreSQL 15+)
--  Esquema: public (expuesto automáticamente a la API REST de Supabase)
--
--  Contenido:
--    1. Configuración del evento (fechas y límites de puntaje)
--    2. Tabla de jugadores (información de inicio de sesión de la API)
--    3. Tabla de partidas (con restricción única por cédula para sobreescribir)
--    4. Validaciones y triggers (anti-trampa y registro de ingresos)
--    5. Vistas de ranking (general de jugadores y por departamentos)
--    6. Permisos y políticas de seguridad (RLS para anon y authenticated)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Configuración del evento (una sola fila)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evento (
    id                smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nombre            text        NOT NULL,
    inicio            timestamptz NOT NULL,
    fin               timestamptz NOT NULL,
    max_partidas_dia  smallint    NOT NULL DEFAULT 1,
    -- Puntaje máximo creíble en dificultad Fácil. Se multiplica por el
    -- multiplicador de cada dificultad (Media x1.5, Difícil x2.0).
    max_puntaje_base  integer     NOT NULL DEFAULT 35000,
    CHECK (fin > inicio)
);

-- Evento activo (configurado para permitir partidas desde septiembre 2026, 1 sola oportunidad por jugador)
INSERT INTO public.evento (id, nombre, inicio, fin, max_partidas_dia, max_puntaje_base)
VALUES (1, 'Semana SST 2026', '2026-09-01 00:00:00-05', '2026-11-30 23:59:59-05', 1, 35000)
ON CONFLICT (id) DO UPDATE 
SET inicio = EXCLUDED.inicio, 
    fin = EXCLUDED.fin, 
    nombre = EXCLUDED.nombre,
    max_partidas_dia = 1,
    max_puntaje_base = EXCLUDED.max_puntaje_base;

-- ---------------------------------------------------------------------
-- 2. Jugadores: colaboradores registrados desde la API de empleados
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jugador (
    id                  bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cedula              varchar(12)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{5,12}$'),
    nombre              varchar(150) NOT NULL,
    area                varchar(100),
    cargo               varchar(100),
    estado              varchar(50)  DEFAULT 'ACTIVO',
    primer_ingreso      timestamptz  NOT NULL DEFAULT now(),
    ultimo_ingreso      timestamptz  NOT NULL DEFAULT now(),
    total_ingresos      integer      NOT NULL DEFAULT 1,
    perfil              jsonb        NOT NULL DEFAULT '{}'::jsonb,
    avatar              jsonb        NOT NULL DEFAULT '{"genero":"m","pielId":2,"peloId":"corto","colorPeloId":1,"accesorioId":"diadema"}'::jsonb
);

-- Asegurar columnas perfil y avatar si la tabla ya existía previamente
ALTER TABLE public.jugador ADD COLUMN IF NOT EXISTS perfil jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.jugador ADD COLUMN IF NOT EXISTS avatar jsonb NOT NULL DEFAULT '{"genero":"m","pielId":2,"peloId":"corto","colorPeloId":1,"accesorioId":"diadema"}'::jsonb;

CREATE INDEX IF NOT EXISTS jugador_cedula_idx ON public.jugador (cedula);
CREATE INDEX IF NOT EXISTS jugador_area_idx ON public.jugador (area);

-- Trigger para actualizar fecha del último ingreso y sumar ingresos
CREATE OR REPLACE FUNCTION public.actualizar_ingreso_jugador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.ultimo_ingreso := now();
    IF TG_OP = 'UPDATE' THEN
        NEW.total_ingresos := COALESCE(OLD.total_ingresos, 0) + 1;
        NEW.primer_ingreso := OLD.primer_ingreso;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jugador_ingreso ON public.jugador;
CREATE TRIGGER jugador_ingreso
    BEFORE INSERT OR UPDATE ON public.jugador
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_ingreso_jugador();

-- Si se elimina un jugador, eliminar automáticamente sus partidas
CREATE OR REPLACE FUNCTION public.eliminar_partida_de_jugador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.partida WHERE cedula = OLD.cedula;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS jugador_borrar_partida_trg ON public.jugador;
CREATE TRIGGER jugador_borrar_partida_trg
    AFTER DELETE ON public.jugador
    FOR EACH ROW EXECUTE FUNCTION public.eliminar_partida_de_jugador();

-- Reiniciar automáticamente la secuencia de ID de jugador al eliminar registros
CREATE OR REPLACE FUNCTION public.auto_reiniciar_id_jugador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    max_id bigint;
    seq_name text;
BEGIN
    seq_name := pg_get_serial_sequence('public.jugador', 'id');
    IF seq_name IS NOT NULL THEN
        SELECT MAX(id) INTO max_id FROM public.jugador;
        IF max_id IS NULL THEN
            -- Si la tabla quedó totalmente vacía, reiniciar a 1
            EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
        ELSE
            -- Si quedan registros, ajustar la secuencia al máximo ID actual
            PERFORM setval(seq_name, max_id, true);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS jugador_auto_reiniciar_id_trg ON public.jugador;
CREATE TRIGGER jugador_auto_reiniciar_id_trg
    AFTER DELETE ON public.jugador
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.auto_reiniciar_id_jugador();

-- ---------------------------------------------------------------------
-- 3. Partidas: una fila por cada jugador (SOLO 1 OPORTUNIDAD POR JUGADOR)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partida (
    id                  bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cedula              varchar(12)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{5,12}$'),
    nombre              varchar(150) NOT NULL,
    area                varchar(100),
    dificultad          varchar(8)   NOT NULL CHECK (dificultad IN ('facil','media','dificil')),
    multiplicador       numeric(3,1) NOT NULL,           -- asignado por trigger
    puntaje             integer      NOT NULL CHECK (puntaje >= 0),
    porcentaje_aciertos smallint     CHECK (porcentaje_aciertos BETWEEN 0 AND 100),
    vencio_drenador     boolean      NOT NULL DEFAULT false,
    capitulos           jsonb        NOT NULL DEFAULT '[]'::jsonb,
    avatar              jsonb        DEFAULT NULL,
    jugada_en           timestamptz  NOT NULL DEFAULT now(),
    valida              boolean      NOT NULL DEFAULT true,
    observacion         text
);

-- Asegurar columna avatar en partida si la tabla ya existía
ALTER TABLE public.partida ADD COLUMN IF NOT EXISTS avatar jsonb DEFAULT NULL;

-- Asegurar la restricción UNIQUE en cédula (1 intento por jugador):
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'partida_cedula_key'
    ) THEN
        ALTER TABLE public.partida ADD CONSTRAINT partida_cedula_key UNIQUE (cedula);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS partida_cedula_puntaje_idx
    ON public.partida (cedula, puntaje DESC, jugada_en);
CREATE INDEX IF NOT EXISTS partida_jugada_en_idx
    ON public.partida (jugada_en);

-- ---------------------------------------------------------------------
-- 4. Validaciones al registrar partida (anti-trampa y oportunidad única)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_partida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ev      public.evento;
BEGIN
    SELECT * INTO ev FROM public.evento WHERE id = 1;

    -- Validar que solo se permita 1 oportunidad de juego por colaborador:
    IF TG_OP = 'UPDATE' AND OLD.valida THEN
        RAISE EXCEPTION 'oportunidad_agotada'
            USING DETAIL = format('El colaborador con cédula %s ya completó su única oportunidad en el evento y no puede modificar su puntaje.', NEW.cedula);
    END IF;

    NEW.jugada_en := now();
    NEW.multiplicador := CASE NEW.dificultad
                             WHEN 'facil'   THEN 1.0
                             WHEN 'media'   THEN 1.5
                             WHEN 'dificil' THEN 2.0
                             ELSE 1.0
                         END;

    IF NEW.puntaje > ev.max_puntaje_base * NEW.multiplicador THEN
        RAISE EXCEPTION 'puntaje_invalido'
            USING DETAIL = format('Puntaje %s supera el máximo permitido para %s (%s)', 
                                  NEW.puntaje, NEW.dificultad, ev.max_puntaje_base * NEW.multiplicador);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partida_validar ON public.partida;
CREATE TRIGGER partida_validar
    BEFORE INSERT OR UPDATE ON public.partida
    FOR EACH ROW EXECUTE FUNCTION public.validar_partida();

-- Reiniciar automáticamente la secuencia de ID de partida al eliminar registros
CREATE OR REPLACE FUNCTION public.auto_reiniciar_id_partida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    max_id bigint;
    seq_name text;
BEGIN
    seq_name := pg_get_serial_sequence('public.partida', 'id');
    IF seq_name IS NOT NULL THEN
        SELECT MAX(id) INTO max_id FROM public.partida;
        IF max_id IS NULL THEN
            -- Si la tabla quedó totalmente vacía, reiniciar a 1
            EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
        ELSE
            -- Si quedan partidas, ajustar la secuencia al máximo ID actual
            PERFORM setval(seq_name, max_id, true);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS partida_auto_reiniciar_id_trg ON public.partida;
CREATE TRIGGER partida_auto_reiniciar_id_trg
    AFTER DELETE ON public.partida
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.auto_reiniciar_id_partida();

-- ---------------------------------------------------------------------
-- 5. Vistas de Ranking
-- ---------------------------------------------------------------------

-- Vista base: puntaje actual de cada jugador en las fechas del evento
CREATE OR REPLACE VIEW public.ranking AS
WITH en_evento AS (
    SELECT p.*
      FROM public.partida p
      JOIN public.evento e ON e.id = 1
     WHERE p.valida
       AND p.jugada_en >= e.inicio
       AND p.jugada_en <  e.fin
),
mejores AS (
    SELECT DISTINCT ON (cedula)
           cedula, nombre, area, puntaje, dificultad, vencio_drenador, jugada_en
      FROM en_evento
     ORDER BY cedula, jugada_en DESC
),
conteo AS (
    SELECT cedula, count(*) AS partidas FROM en_evento GROUP BY cedula
)
SELECT row_number() OVER (ORDER BY m.puntaje DESC, m.jugada_en ASC) AS posicion,
       m.cedula, m.nombre, m.area, m.puntaje, m.dificultad,
       m.vencio_drenador, m.jugada_en AS logrado_en, c.partidas
  FROM mejores m
  JOIN conteo c USING (cedula);

-- Ranking público de jugadores (Top 20 para el podio y la lista)
CREATE OR REPLACE VIEW public.ranking_publico AS
SELECT posicion, cedula, nombre, area, puntaje, dificultad
  FROM public.ranking
 WHERE posicion <= 20
 ORDER BY posicion;

-- Ranking por departamentos / áreas (ordenado por puntaje promedio)
CREATE OR REPLACE VIEW public.ranking_areas AS
SELECT coalesce(nullif(trim(area), ''), 'Sin área') AS area,
       count(DISTINCT cedula)::int AS participantes,
       round(avg(puntaje))::int AS promedio,
       max(puntaje)::int AS mejor
  FROM public.ranking
 GROUP BY 1
 ORDER BY promedio DESC, participantes DESC;

-- Trigger para permitir eliminar registros directamente desde la vista ranking en Supabase:
CREATE OR REPLACE FUNCTION public.eliminar_ranking_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.partida WHERE cedula = OLD.cedula;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ranking_delete_trg ON public.ranking;
CREATE TRIGGER ranking_delete_trg
    INSTEAD OF DELETE ON public.ranking
    FOR EACH ROW EXECUTE FUNCTION public.eliminar_ranking_trigger();

-- ---------------------------------------------------------------------
-- 6. Permisos y Políticas de Seguridad (RLS)
-- ---------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.evento TO anon, authenticated;
GRANT INSERT, UPDATE, SELECT, DELETE ON public.jugador TO anon, authenticated;
GRANT INSERT, UPDATE, SELECT, DELETE ON public.partida TO anon, authenticated;
GRANT SELECT, DELETE ON public.ranking TO anon, authenticated;
GRANT SELECT ON public.ranking_publico TO anon, authenticated;
GRANT SELECT ON public.ranking_areas TO anon, authenticated;

-- RLS: Evento
ALTER TABLE public.evento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir leer evento" ON public.evento;
CREATE POLICY "Permitir leer evento" ON public.evento FOR SELECT TO anon, authenticated USING (true);

-- RLS: Jugadores
ALTER TABLE public.jugador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir insertar jugadores" ON public.jugador;
CREATE POLICY "Permitir insertar jugadores" ON public.jugador 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizar jugadores" ON public.jugador;
CREATE POLICY "Permitir actualizar jugadores" ON public.jugador 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leer jugadores" ON public.jugador;
CREATE POLICY "Permitir leer jugadores" ON public.jugador 
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir eliminar jugadores" ON public.jugador;
CREATE POLICY "Permitir eliminar jugadores" ON public.jugador 
    FOR DELETE TO anon, authenticated USING (true);

-- RLS: Partidas
ALTER TABLE public.partida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir insertar partidas" ON public.partida;
CREATE POLICY "Permitir insertar partidas" ON public.partida 
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizar partidas" ON public.partida;
CREATE POLICY "Permitir actualizar partidas" ON public.partida 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminar partidas" ON public.partida;
CREATE POLICY "Permitir eliminar partidas" ON public.partida 
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir leer partidas para ranking y trigger" ON public.partida;
CREATE POLICY "Permitir leer partidas para ranking y trigger" ON public.partida 
    FOR SELECT TO anon, authenticated USING (true);