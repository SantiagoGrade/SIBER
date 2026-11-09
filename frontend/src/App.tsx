import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ReactNode } from "react";
import { Spinner } from "./components/ui";

import Login from "./pages/auth/Login";
import Recuperar from "./pages/auth/Recuperar";
import Restablecer from "./pages/auth/Restablecer";
import SolicitarFormacion from "./pages/public/SolicitarFormacion";
import CancelarReserva from "./pages/public/CancelarReserva";
import PropuestaFecha from "./pages/public/PropuestaFecha";
import Asistencia from "./pages/public/Asistencia";
import DashboardAdmin from "./pages/admin/Dashboard";
import ReservasAdmin from "./pages/admin/Reservas";
import ReasignacionesAdmin from "./pages/admin/Reasignaciones";


import CuentasAdmin from "./pages/admin/Cuentas";

import ConfiguracionAdmin from "./pages/admin/Configuracion";
import DashboardFormador from "./pages/formador/Dashboard";
import CalendarioFormador from "./pages/formador/Calendario";
import FormacionesFormador from "./pages/formador/Formaciones";
import DisponibilidadFormador from "./pages/formador/Disponibilidad";
import ReasignacionesFormador from "./pages/formador/Reasignaciones";

function Protegida({ children, roles }: { children: ReactNode; roles: string[] }) {
  const { cuenta, cargando } = useAuth();
  if (cargando) return <Spinner />;
  if (!cuenta) return <Navigate to="/login" replace />;
  if (!roles.includes(cuenta.rol)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Inicio() {
  const { cuenta, cargando } = useAuth();
  if (cargando) return <Spinner />;
  if (!cuenta) return <Navigate to="/solicitar" replace />;
  return <Navigate to={cuenta.rol === "FORMADOR" ? "/formador" : "/admin"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/solicitar" element={<SolicitarFormacion />} />
          <Route path="/cancelar-reserva" element={<CancelarReserva />} />
          <Route path="/propuesta-fecha" element={<PropuestaFecha />} />
          <Route path="/asistencia/:token" element={<Asistencia />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/restablecer-password" element={<Restablecer />} />
          <Route path="/admin" element={<Protegida roles={["SUPER_ADMIN", "ADMIN"]}><DashboardAdmin /></Protegida>} />
          <Route path="/admin/reservas" element={<Protegida roles={["SUPER_ADMIN", "ADMIN"]}><ReservasAdmin /></Protegida>} />
          <Route path="/admin/reasignaciones" element={<Protegida roles={["SUPER_ADMIN", "ADMIN"]}><ReasignacionesAdmin /></Protegida>} />
          <Route path="/admin/formadores" element={<Navigate to="/admin/cuentas" replace />} />
          <Route path="/admin/cursos" element={<Navigate to="/admin/cuentas" replace />} />
          <Route path="/admin/cuentas" element={<Protegida roles={["SUPER_ADMIN", "ADMIN"]}><CuentasAdmin /></Protegida>} />

          <Route path="/admin/configuracion" element={<Protegida roles={["SUPER_ADMIN", "ADMIN"]}><ConfiguracionAdmin /></Protegida>} />
          <Route path="/formador" element={<Protegida roles={["FORMADOR"]}><DashboardFormador /></Protegida>} />
          <Route path="/formador/calendario" element={<Protegida roles={["FORMADOR"]}><CalendarioFormador /></Protegida>} />
          <Route path="/formador/formaciones" element={<Protegida roles={["FORMADOR"]}><FormacionesFormador /></Protegida>} />
          <Route path="/formador/disponibilidad" element={<Protegida roles={["FORMADOR"]}><DisponibilidadFormador /></Protegida>} />
          <Route path="/formador/reasignaciones" element={<Protegida roles={["FORMADOR"]}><ReasignacionesFormador /></Protegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
