import React, { useState } from 'react';
import logoImg from '../assets/logo.webp';
import { validarCedula } from '../game/api';
import { activarAudio } from '../game/audio';

export default function LoginScreen({ onLoginSuccess }) {
  const [cedula, setCedula] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    activarAudio();

    const cleanCedula = cedula.replace(/\D/g, '');
    if (cleanCedula.length < 5) {
      setError('Escribe tu número de cédula completo, sin puntos.');
      return;
    }

    setError('');
    setCargando(true);

    try {
      const resp = await validarCedula(cleanCedula);
      if (!resp.ok) {
        setError(resp.msg);
        setCargando(false);
        return;
      }

      onLoginSuccess({
        cedula: cleanCedula,
        nombre: resp.nombre,
        area: resp.area,
        token: resp.token
      });
    } catch (err) {
      setError('Error al procesar la entrada. Intenta nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setCedula(val);
    if (error) setError('');
  };

  return (
    <section className="pantalla" id="p-login">
      <form className="login-caja" onSubmit={handleSubmit} noValidate>
        <img src={logoImg} alt="Sistemas Palacios" />
        <h1 className="login-titulo">Batería al 100</h1>
        <p className="login-sub">Semana de Seguridad y Salud en el Trabajo</p>

        <label htmlFor="cedula">Número de cédula</label>
        <input
          id="cedula"
          name="cedula"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          placeholder="Ej: 1085123456"
          value={cedula}
          onChange={handleChange}
          autoFocus
          disabled={cargando}
        />

        {error && <p className="login-error">{error}</p>}

        <button className="btn-rojo" type="submit" id="btn-login" disabled={cargando}>
          {cargando ? 'Verificando…' : 'Ingresar'}
        </button>

        <p className="login-pie">
          ⚡ <b>1 sola oportunidad:</b> tu puntaje final quedará registrado en el ranking de la Semana SST.
        </p>
      </form>
    </section>
  );
}
