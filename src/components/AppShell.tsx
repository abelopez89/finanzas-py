'use client';

import { useState, useEffect } from 'react';
import { Sidebar, BottomNav, TopBar } from './Nav';

const CLAVE_PREFERENCIA = 'finanzaspy:menu-contraido';

/**
 * Contenedor de la app en escritorio: mantiene el estado del menú lateral
 * (expandido / contraído) y ajusta el ancho del contenido en consecuencia.
 * La preferencia se recuerda entre visitas.
 */
export default function AppShell({
  email,
  logout,
  children,
}: {
  email?: string;
  logout: () => void;
  children: React.ReactNode;
}) {
  // Arranca expandido y recién después lee la preferencia guardada: leerla
  // durante el render rompería la hidratación (el servidor no la conoce).
  const [contraido, setContraido] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      setContraido(window.localStorage.getItem(CLAVE_PREFERENCIA) === '1');
    } catch {
      // Modo privado o almacenamiento bloqueado: se queda expandido.
    }
    setListo(true);
  }, []);

  // Atajo: [ contrae/expande. Se ignora si el foco está en un campo, para
  // no dispararlo mientras se escribe un nombre de gasto.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
      const activo = document.activeElement;
      const escribiendo =
        activo instanceof HTMLElement &&
        (activo.tagName === 'INPUT' ||
          activo.tagName === 'TEXTAREA' ||
          activo.tagName === 'SELECT' ||
          activo.isContentEditable);
      if (escribiendo) return;
      alternar();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  function alternar() {
    setContraido((prev) => {
      const nuevo = !prev;
      try {
        window.localStorage.setItem(CLAVE_PREFERENCIA, nuevo ? '1' : '0');
      } catch {
        // Sin persistencia, pero el cambio igual aplica en esta sesión.
      }
      return nuevo;
    });
  }

  return (
    <div className="min-h-screen">
      <Sidebar email={email} logout={logout} contraido={contraido} alternar={alternar} />
      <TopBar email={email} logout={logout} />

      <main
        className={`px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8 ${
          listo ? 'md:transition-[margin] md:duration-200' : ''
        } ${contraido ? 'md:ml-[68px]' : 'md:ml-60'}`}
      >
        {/* Al contraer, el contenido puede usar más ancho */}
        <div className={`mx-auto w-full ${contraido ? 'max-w-7xl' : 'max-w-5xl'}`}>{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}
