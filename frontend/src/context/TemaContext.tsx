import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Tema = "claro" | "oscuro";
const CLAVE = "siber-tema";

interface TemaCtx {
  tema: Tema;
  alternar: () => void;
}

const Ctx = createContext<TemaCtx>({ tema: "claro", alternar: () => {} });

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() =>
    document.documentElement.classList.contains("dark") ? "oscuro" : "claro"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
    try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento */ }
  }, [tema]);

  // Si el usuario nunca eligió tema, seguir en vivo la preferencia del SO
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (!localStorage.getItem(CLAVE)) setTema(e.matches ? "oscuro" : "claro");
      } catch { /* sin almacenamiento */ }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <Ctx.Provider value={{ tema, alternar: () => setTema(t => (t === "oscuro" ? "claro" : "oscuro")) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTema() {
  return useContext(Ctx);
}
