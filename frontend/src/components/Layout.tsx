import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/TemaContext";
import { ManualUsuario } from "./ManualUsuario";

interface NavItem { to: string; label: string; end?: boolean }

function BotonTema({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  const oscuro = tema === "oscuro";
  return (
    <button
      onClick={alternar}
      title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 text-primary transition duration-150 hover:bg-primary/10 dark:border-night-600 dark:text-amber-300 dark:hover:bg-night-800 ${className}`}
    >
      {oscuro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

const navCls = (isActive: boolean) =>
  `whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition duration-150 ${
    isActive ? "bg-primary text-white shadow-sm" : "text-primary dark:text-primary-soft hover:bg-primary/10 dark:hover:bg-primary/20"
  }`;

const navMovilCls = (isActive: boolean) =>
  `block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition duration-150 ${
    isActive ? "bg-primary text-white" : "text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20"
  }`;

function Header({ items }: { items: NavItem[] }) {
  const { cuenta, logout } = useAuth();
  const { tema, alternar } = useTema();
  const nav = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  const salir = async () => { await logout(); nav("/login"); };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 dark:border-night-800 bg-white dark:bg-night-900 shadow-sm">
      <nav className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src="/colmayor.png" alt="Colegio Mayor de Antioquia" className="h-7 shrink-0 object-contain drop-shadow-[0_1px_3px_rgb(0_0_0/0.45)] sm:h-9" />
          <div className="flex flex-col leading-tight">
            <span className="whitespace-nowrap text-sm font-bold text-primary dark:text-primary-soft sm:text-base">Colegio Mayor de Antioquia</span>
            <span className="whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">SIBER · Reservas</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-0.5 xl:flex">
            {items.map(i => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => navCls(isActive)}>
                {i.label}
              </NavLink>
            ))}
            {cuenta && (
              <span className="ml-1 hidden max-w-40 truncate px-1 text-xs text-gray-500 dark:text-gray-400 2xl:block" title={cuenta.nombreCompleto}>
                {cuenta.nombreCompleto}
              </span>
            )}
            <BotonTema className="ml-1" />
            <button
              onClick={() => setAyuda(true)}
              title="Manual de usuario"
              aria-label="Manual de usuario"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 dark:border-primary-soft/40 text-sm font-bold text-primary dark:text-primary-soft transition duration-150 hover:bg-primary/10 dark:hover:bg-primary/20"
            >
              ?
            </button>
            <button
              onClick={salir}
              className="ml-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition duration-150 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Cerrar sesión
            </button>
          </div>

          <button
            onClick={() => setAbierto(v => !v)}
            aria-label="Abrir menú"
            aria-expanded={abierto}
            className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 dark:border-night-700 transition hover:bg-gray-50 dark:hover:bg-night-800 xl:hidden"
          >
            <span className={`block h-0.5 w-5 bg-primary transition-all duration-200 ${abierto ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-primary transition-all duration-200 ${abierto ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-primary transition-all duration-200 ${abierto ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </button>
        </div>
      </nav>

      {abierto && (
        <div className="border-t border-gray-100 dark:border-night-800 px-3 py-2 xl:hidden">
          {cuenta && (
            <p className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{cuenta.nombreCompleto}</p>
          )}
          {items.map(i => (
            <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setAbierto(false)} className={({ isActive }) => navMovilCls(isActive)}>
              {i.label}
            </NavLink>
          ))}
          <hr className="my-1 border-gray-100 dark:border-night-800" />
          <button onClick={alternar} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-primary dark:text-primary-soft transition hover:bg-primary/10 dark:hover:bg-primary/20">
            {tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
          </button>
          <button onClick={() => { setAbierto(false); setAyuda(true); }} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-primary dark:text-primary-soft transition hover:bg-primary/10 dark:hover:bg-primary/20">
            Ayuda · Manual de usuario
          </button>
          <button onClick={salir} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-500/10">
            Cerrar sesión
          </button>
        </div>
      )}

      {cuenta && <ManualUsuario abierto={ayuda} onClose={() => setAyuda(false)} rol={cuenta.rol} />}
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/25 bg-black/35 px-4 py-3.5 text-center text-sm font-medium text-white dark:border-night-700 dark:bg-night-800 dark:text-gray-200">
      © {new Date().getFullYear()} · Desarrollado por Carlos Andres Garcés Zapata para Colegio Mayor de Antioquia. Todos los derechos reservados.
    </footer>
  );
}

function Shell({ children, items, titulo, amplio = true }: { children: ReactNode; items: NavItem[]; titulo: string; amplio?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-accent dark:from-night-950 dark:to-night-850">
      <Header items={items} />
      <main className={`mx-auto w-full flex-1 px-4 pb-8 sm:px-6 ${amplio ? "max-w-screen-2xl pt-4 lg:px-8" : "max-w-7xl pt-8 lg:px-8"}`}>
        {amplio ? (
          <h1 className="mb-4 text-2xl font-bold text-white">{titulo}</h1>
        ) : (
          <div className="card mb-6 px-6 py-4">
            <h1 className="text-2xl font-bold text-primary dark:text-primary-soft">{titulo}</h1>
          </div>
        )}
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function AdminLayout({ children, titulo, amplio }: { children: ReactNode; titulo: string; amplio?: boolean }) {
  const items: NavItem[] = [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/reservas", label: "Reservas" },
    { to: "/admin/reasignaciones", label: "Reasignaciones" },
    { to: "/admin/cuentas", label: "Cuentas y cursos" },

    { to: "/admin/configuracion", label: "Configuración" },
  ];
  return <Shell items={items} titulo={titulo} amplio={amplio}>{children}</Shell>;
}

export function FormadorLayout({ children, titulo, amplio }: { children: ReactNode; titulo: string; amplio?: boolean }) {
  const items: NavItem[] = [
    { to: "/formador", label: "Mi dashboard", end: true },
    { to: "/formador/calendario", label: "Mi calendario" },
    { to: "/formador/formaciones", label: "Mis formaciones" },
    { to: "/formador/disponibilidad", label: "Mi disponibilidad" },
    { to: "/formador/reasignaciones", label: "Reasignaciones" },
  ];
  return <Shell items={items} titulo={titulo} amplio={amplio}>{children}</Shell>;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primary dark:bg-night-950">
      <div className="absolute -left-48 -top-48 h-[38rem] w-[38rem] rounded-full border border-white/10 dark:border-primary-soft/10" aria-hidden="true" />
      <div className="absolute -bottom-56 -right-40 h-[42rem] w-[42rem] rounded-full border border-white/10 dark:border-primary-soft/10" aria-hidden="true" />
      <div className="absolute right-4 top-4 z-20"><BotonTema /></div>
      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <Footer />
    </main>
  );
}

export function AuthMarca({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="text-center">
      <img src="/colmayor.png" alt="Colegio Mayor de Antioquia" className="mx-auto mb-3 h-14 object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]" />
      <div className="text-sm font-medium leading-snug text-primary dark:text-primary-soft">
        Institución Universitaria<br />Colegio Mayor de Antioquia
      </div>
      <div className="mt-3 text-2xl font-bold text-primary dark:text-primary-soft">{titulo}</div>
      {subtitulo && <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitulo}</div>}
    </div>
  );
}

export function PublicLayout({ children, amplio }: { children: ReactNode; amplio?: boolean }) {
  const ancho = amplio ? "max-w-screen-2xl" : "max-w-3xl";
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-accent dark:from-night-950 dark:to-night-850">
      <header className="border-b border-gray-100 dark:border-night-800 bg-white dark:bg-night-900 shadow-sm">
        <div className="flex w-full items-center gap-2.5 px-4 py-3 sm:px-6 lg:px-8">
          <img src="/colmayor.png" alt="Colegio Mayor de Antioquia" className="h-7 shrink-0 object-contain drop-shadow-[0_1px_3px_rgb(0_0_0/0.45)] sm:h-9" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-primary dark:text-primary-soft sm:text-base">Colegio Mayor de Antioquia</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">SIBER · Sistema Bibliotecario de Reservas</span>
          </div>
          <BotonTema className="ml-auto" />
        </div>
      </header>
      <main className={`mx-auto w-full ${ancho} flex-1 p-4 ${amplio ? "pb-8 sm:px-6 lg:px-8" : "pb-16"}`}>{children}</main>
      <Footer />
    </div>
  );
}
