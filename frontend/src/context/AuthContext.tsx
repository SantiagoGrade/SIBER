import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { Cuenta } from "../api/types";

interface AuthCtx {
  cuenta: Cuenta | null;
  cargando: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get("/auth/perfil")
      .then(r => setCuenta(r.data))
      .catch(() => setCuenta(null))
      .finally(() => setCargando(false));
  }, []);

  const login = async (usuario: string, password: string) => {
    await api.post("/auth/login", { usuario, password });
    const r = await api.get("/auth/perfil");
    setCuenta(r.data);
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setCuenta(null);
  };

  return <Ctx.Provider value={{ cuenta, cargando, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
