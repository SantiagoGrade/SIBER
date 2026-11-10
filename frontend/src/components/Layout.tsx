import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ManualUsuario } from "./ManualUsuario";

interface NavItem { to: string; label: string; end?: boolean }

const navCls = (isActive: boolean) =>
  `whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition duration-150 ${
    isActive ? "bg-primary text-white shadow-sm" : "text-primary hover:bg-primary/10"
  }`;

const navMovilCls = (isActive: boolean) =>
  `block w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition duration-150 ${
    isActive ? "bg-primary text-white" : "text-gray-700 hover:bg-primary/10"
  }`;

function Header({ items }: { items: NavItem[] }) {
  const { cuenta, logout } = useAuth();
  const nav = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  const salir = async () => { await logout(); nav("/login"); };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <nav className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.jpeg" alt="Colegio Mayor de Antioquia" className="h-7 shrink-0 object-contain sm:h-9" />
          <div className="flex flex-col leading-tight">
            <span className="whitespace-nowrap text-sm font-bold text-primary sm:text-base">Colegio Mayor de Antioquia</span>
            <span className="whitespace-nowrap text-xs font-medium text-gray-500">SIFOIN · Formación Institucional</span>
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
              <span className="ml-1 hidden max-w-40 truncate px-1 text-xs text-gray-500 2xl:block" title={cuenta.nombreCompleto}>
                {cuenta.nombreCompleto}
              </span>
            )}
            <button
              onClick={() => setAyuda(true)}
              title="Manual de usuario"
              aria-label="Manual de usuario"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 text-sm font-bold text-primary transition duration-150 hover:bg-primary/10"
            >
              ?
            </button>
            <button
              onClick={salir}
              className="ml-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold text-red-600 transition duration-150 hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>

          <button
            onClick={() => setAbierto(v => !v)}
            aria-label="Abrir menú"
            aria-expanded={abierto}
            className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 transition hover:bg-gray-50 xl:hidden"
          >
            <span className={`block h-0.5 w-5 bg-primary transition-all duration-200 ${abierto ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-primary transition-all duration-200 ${abierto ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-primary transition-all duration-200 ${abierto ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </button>
        </div>
      </nav>

      {abierto && (
        <div className="border-t border-gray-100 px-3 py-2 xl:hidden">
          {cuenta && (
            <p className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-gray-400">{cuenta.nombreCompleto}</p>
          )}
          {items.map(i => (
            <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setAbierto(false)} className={({ isActive }) => navMovilCls(isActive)}>
              {i.label}
            </NavLink>
          ))}
          <hr className="my-1 border-gray-100" />
          <button onClick={() => { setAbierto(false); setAyuda(true); }} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-primary transition hover:bg-primary/10">
            Ayuda · Manual de usuario
          </button>
          <button onClick={salir} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">
            Cerrar sesión
          </button>
        </div>
      )}

      {cuenta && <ManualUsuario abierto={ayuda} onClose={() => setAyuda(false)} rol={cuenta.rol} />}
    </header>
  );
}

function Shell({ children, items, titulo, amplio = true }: { children: ReactNode; items: NavItem[]; titulo: string; amplio?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-accent">
      <Header items={items} />
      <main className={`mx-auto w-full flex-1 px-4 pb-8 sm:px-6 ${amplio ? "max-w-screen-2xl pt-4 lg:px-8" : "max-w-7xl pt-8 lg:px-8"}`}>
        {amplio ? (
          <h1 className="mb-4 text-2xl font-bold text-white">{titulo}</h1>
        ) : (
          <div className="card mb-6 px-6 py-4">
            <h1 className="text-2xl font-bold text-primary">{titulo}</h1>
          </div>
        )}
        {children}
      </main>
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-primary px-4 py-8">
      <div className="absolute -left-48 -top-48 h-[38rem] w-[38rem] rounded-full border border-white/10" aria-hidden="true" />
      <div className="absolute -bottom-56 -right-40 h-[42rem] w-[42rem] rounded-full border border-white/10" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </main>
  );
}

export function AuthMarca({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <div className="text-center">
      <img src="/logo.jpeg" alt="Colegio Mayor de Antioquia" className="mx-auto mb-3 h-14 object-contain" />
      <div className="text-sm font-medium leading-snug text-primary">
        Institución Universitaria<br />Colegio Mayor de Antioquia
      </div>
      <div className="mt-3 text-2xl font-bold text-primary">{titulo}</div>
      {subtitulo && <div className="mt-0.5 text-sm text-gray-500">{subtitulo}</div>}
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-accent">
      <header className="border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3">
          <img src="/logo.jpeg" alt="Colegio Mayor de Antioquia" className="h-7 shrink-0 object-contain sm:h-9" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-primary sm:text-base">Colegio Mayor de Antioquia</span>
            <span className="text-xs font-medium text-gray-500">SIFOIN · Formación Institucional — Biblioteca</span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-16">{children}</main>
    </div>
  );
}
