import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { ErrorMsg, OkMsg } from "../../components/ui";

const CLAVES: { clave: string; descripcion: string; tipo: "number" | "text" }[] = [
  { clave: "anticipacion_minima_dias", descripcion: "Anticipación mínima para reservar (días de calendario)", tipo: "number" },
  { clave: "cancelacion_min_horas", descripcion: "Límite de cancelación del docente (horas antes)", tipo: "number" },
  { clave: "qr_envio_minutos", descripcion: "Minutos tras el inicio para enviar el QR", tipo: "number" },
  { clave: "asistencia_cierre_minutos", descripcion: "Minutos tras finalizar el curso en que se cierra el registro", tipo: "number" },
];

export default function Configuracion() {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const c of CLAVES) {
        try {
          const r = await api.get(`/admin/configuracion/${c.clave}`);
          out[c.clave] = r.data.valor == null ? "" : String(r.data.valor);
        } catch { out[c.clave] = ""; }
      }
      setValores(out);
    })();
  }, []);

  const guardar = async (clave: string, tipo: string) => {
    try {
      const v = valores[clave];
      await api.put("/admin/configuracion", { clave, valor: tipo === "number" ? Number(v) : v });
      setOk("Configuración guardada");
    } catch (e) { setError(mensajeError(e)); }
  };

  return (
    <AdminLayout titulo="Configuración del sistema">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />
      <div className="card mt-3 space-y-4">
        {CLAVES.map(c => (
          <div key={c.clave} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{c.descripcion}</div>
              <div className="text-xs text-gray-400 font-mono">{c.clave}</div>
            </div>
            {c.tipo === "text"
              ? <textarea className="input-base flex-1" rows={2} value={valores[c.clave] ?? ""} onChange={e => setValores({ ...valores, [c.clave]: e.target.value })} />
              : <input type="number" className="input-base w-28" value={valores[c.clave] ?? ""} onChange={e => setValores({ ...valores, [c.clave]: e.target.value })} />}
            <button className="btn-primary text-xs" onClick={() => guardar(c.clave, c.tipo)}>Guardar</button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
