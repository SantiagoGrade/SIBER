import { ReactNode, useEffect } from "react";

interface Props { abierto: boolean; onClose: () => void; rol: "SUPER_ADMIN" | "ADMIN" | "FORMADOR" }

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-bold uppercase tracking-wide text-primary">{titulo}</h3>
      <div className="mt-2 space-y-2 text-sm text-gray-700">{children}</div>
    </section>
  );
}

function Punto({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <div className="font-semibold text-gray-800">{titulo}</div>
      <div className="mt-1 space-y-1 text-gray-600">{children}</div>
    </div>
  );
}

function SiNo({ si, no }: { si: string[]; no: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="font-semibold text-emerald-800">Sí puedes</div>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-emerald-800">{si.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
        <div className="font-semibold text-red-800">No puedes</div>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-red-800">{no.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
    </div>
  );
}

const NOMBRE_ROL = { SUPER_ADMIN: "Super administrador", ADMIN: "Administrador", FORMADOR: "Formador" } as const;

function General() {
  return (
    <>
      <Seccion titulo="¿Qué es SIBER?">
        <p>
          SIBER gestiona las reservas de formaciones institucionales de la Biblioteca. Un docente
          solicita una formación desde el formulario público y el sistema <strong>asigna
          automáticamente un formador</strong>: elige al formador habilitado para ese curso, con
          disponibilidad que cubra todo el horario y con la <strong>menor ocupación semanal</strong>.
          Nadie escoge el formador a mano.
        </p>
      </Seccion>

      <Seccion titulo="Ciclo de vida de una reserva">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="badge-verde">CONFIRMADA</span><span>→</span>
          <span className="badge-azul">EN_CURSO</span><span>→</span>
          <span className="badge-gris">FINALIZADA</span>
          <span className="text-gray-400">o</span>
          <span className="badge-rojo">CANCELADA</span>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>El docente debe reservar con la anticipación mínima configurada (2 días por defecto).</li>
          <li>Los cambios a EN_CURSO y FINALIZADA los hace el sistema solo, según la hora de inicio y fin.</li>
          <li>El docente puede cancelar con el enlace de su correo hasta 2 h antes del inicio.</li>
          <li>La marca <span className="badge-amarillo">incidencia</span> significa que hay una reasignación en trámite; la reserva sigue vigente.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Correos automáticos (no hay que enviarlos a mano)">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Confirmación:</strong> al docente apenas se crea la reserva, con enlace para cancelarla.</li>
          <li><strong>Recordatorio:</strong> el día anterior desde las 12:00, un correo agrupado al docente y otro al formador con aula y datos de contacto.</li>
          <li><strong>QR de asistencia:</strong> al formador, 30 minutos después de iniciada la formación. El registro cierra 1 hora después de terminar.</li>
        </ul>
      </Seccion>
    </>
  );
}

function ManualAdmin({ superAdmin }: { superAdmin: boolean }) {
  return (
    <>
      <General />

      <Seccion titulo="Dashboard">
        <p>
          Estadísticas de satisfacción y uso: formaciones, asistentes, calificaciones y su evolución.
          Filtra por rango de fechas, curso, formador, semestre o año. Las reservas canceladas nunca
          cuentan en los promedios; cuando no hay respuestas verás “—”.
        </p>
      </Seccion>

      <Seccion titulo="Reservas">
        <Punto titulo="Consultar">
          <p>Alterna entre <strong>lista</strong> y <strong>calendario</strong>. Filtra por estado, curso y rango de fechas. Toca una reserva para ver docente, aula, formador asignado y lista de asistentes con sus evaluaciones.</p>
        </Punto>
        <Punto titulo="Cancelar una reserva">
          <p>Solo las CONFIRMADAS se pueden cancelar. Escribe el motivo (obligatorio) y el sistema notifica al docente por correo. Usa esto cuando la formación no pueda realizarse.</p>
        </Punto>
        <Punto titulo="QR de asistencia">
          <p>En el detalle ves el estado del envío del QR, la ventana de registro y cuántas asistencias/evaluaciones van. Puedes <strong>cerrar el registro antes de tiempo</strong> o <strong>reabrirlo</strong> si un asistente quedó por fuera, y exportar la asistencia a Excel.</p>
        </Punto>
      </Seccion>

      <Seccion titulo="Reasignaciones por calamidad">
        <p>
          Cuando un formador no puede dictar una formación, te llega su solicitud aquí. Las que admiten
          acción son las <strong>PENDIENTE</strong> y <strong>SIN_REEMPLAZO</strong>. Tienes cuatro salidas:
        </p>
        <Punto titulo="1. Aprobar con un reemplazo">
          <p>El sistema lista solo formadores <strong>elegibles</strong> (habilitados para el curso, con disponibilidad y sin cruce), ordenados por menor ocupación. Al aprobar, la reserva pasa al nuevo formador. El docente <strong>no</strong> recibe correo por este cambio interno.</p>
        </Punto>
        <Punto titulo="2. Proponer nueva fecha al docente">
          <p>Si nadie puede en el horario original, elige en el calendario un día marcado (hay formadores disponibles en los próximos 30 días), ajusta la hora y envía la propuesta. El docente recibe un enlace: si acepta, el sistema reasigna el formador y reprograma QR y cancelación; si rechaza, la solicitud vuelve a SIN_REEMPLAZO.</p>
        </Punto>
        <Punto titulo="3. Marcar sin reemplazo / Rechazar la solicitud">
          <p>“Sin reemplazo” deja constancia de que no hay quien cubra. “Rechazar” descarta la petición del formador y la reserva sigue vigente con él.</p>
        </Punto>
        <Punto titulo="4. Cancelar la reserva">
          <p>Última opción: anula la formación y notifica al docente con el motivo.</p>
        </Punto>
        <p className="text-xs text-gray-500">
          Mientras la solicitud no se resuelva, la franja original sigue ocupada: nadie más puede tomarla.
        </p>
      </Seccion>

      <Seccion titulo="Cuentas y cursos">
        <Punto titulo="Cuentas">
          <p>
            Crea cuentas con usuario, correo y contraseña (mín. 10 caracteres).
            {superAdmin
              ? " Como super administrador puedes crear cuentas de cualquier rol: FORMADOR, ADMIN y SUPER_ADMIN, y editar otras cuentas SUPER_ADMIN."
              : " Tu rol solo puede crear cuentas de tipo FORMADOR; los demás administradores los gestiona un super administrador."}
            {" "}Desde la tabla puedes editar datos, restablecer contraseña y activar/desactivar cuentas.
          </p>
        </Punto>
        <Punto titulo="Cursos">
          <p>Crea cursos y edítalos (nombre, descripción, activo). Un curso inactivo deja de aparecer en el formulario público pero conserva su historial.</p>
        </Punto>
        <Punto titulo="Gestionar un formador (botón “Gestionar”)">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Cursos que puede impartir:</strong> actívalos o desactívalos con un clic. Sin curso habilitado, el motor nunca lo asignará.</li>
            <li><strong>Disponibilidad semanal:</strong> sus franjas oficiales por día. El formador las ve pero no las edita: tú las defines aquí.</li>
            <li><strong>Excepciones:</strong> vacaciones, incapacidad, calamidad, permiso, bloqueo o fecha especial. Se restan de su disponibilidad.</li>
          </ul>
          <p className="mt-1 text-xs text-gray-500">
            Ojo: no puedes quitar disponibilidad que cubre reservas confirmadas a futuro sin resolverlas antes.
          </p>
        </Punto>
      </Seccion>

      <Seccion titulo="Configuración">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Anticipación mínima:</strong> días de calendario de antelación para que un docente pueda reservar.</li>
          <li><strong>Límite de cancelación:</strong> horas antes del inicio hasta las que el docente puede cancelar.</li>
          <li><strong>Envío del QR:</strong> minutos después del inicio en que sale el correo al formador.</li>
          <li><strong>Cierre de asistencia:</strong> minutos después de terminar en que se cierra el registro.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Qué entra y qué no entra en tus manos">
        <SiNo
          si={[
            "Cancelar reservas confirmadas y gestionar su QR y asistencia",
            "Resolver reasignaciones: reemplazo, nueva fecha o cancelación",
            "Crear y editar cursos, cuentas de formador y su disponibilidad/excepciones",
            "Ajustar los parámetros del sistema en Configuración",
            ...(superAdmin ? ["Crear y editar cuentas ADMIN y SUPER_ADMIN"] : []),
          ]}
          no={[
            "Crear reservas: solo el docente las solicita desde el formulario público",
            "Elegir formador a mano en una reserva nueva: lo asigna el motor automático",
            "Registrar asistencia: los asistentes lo hacen con el QR del formador",
            ...(superAdmin ? [] : ["Crear o editar cuentas ADMIN/SUPER_ADMIN ni desactivar un SUPER_ADMIN"]),
          ]}
        />
      </Seccion>
    </>
  );
}

function ManualFormador() {
  return (
    <>
      <General />

      <Seccion titulo="Tu panel (Mi dashboard)">
        <p>
          Tus cifras: formaciones impartidas, horas y ocupación de la semana, asistentes totales,
          calificación promedio y gráficas de evolución. Abajo ves tus próximas formaciones y las
          observaciones que dejaron los asistentes.
        </p>
      </Seccion>

      <Seccion titulo="Mi calendario y Mis formaciones">
        <Punto titulo="Mi calendario">
          <p>Vista mensual/semanal de las formaciones que tienes asignadas. Úsalo para programar tu semana.</p>
        </Punto>
        <Punto titulo="Mis formaciones">
          <p>El listado completo. Al tocar una ves aula, correo y teléfono del docente, los asistentes registrados con su calificación y el botón para <strong>exportar la asistencia a Excel</strong>.</p>
        </Punto>
      </Seccion>

      <Seccion titulo="El día de la formación: asistencia con QR">
        <ul className="list-disc space-y-1 pl-5">
          <li>30 minutos después de iniciar, te llega un correo con el <strong>QR de asistencia</strong>.</li>
          <li>Proyéctalo o compártelo: cada asistente lo escanea y en un solo formulario registra asistencia y evaluación del curso.</li>
          <li>El registro cierra 1 hora después de terminar la formación. Si alguien quedó por fuera, pide al administrador que lo reabra.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Si no puedes dictar una formación: reasignación por calamidad">
        <p>
          Tú <strong>no puedes cancelar ni mover</strong> una reserva por tu cuenta. El camino correcto es
          pedir una reasignación y que el <strong>administrador encargado</strong> la resuelva:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>En <strong>Mis formaciones</strong>, abre la formación confirmada y diligencia “Solicitar reasignación por calamidad” con el motivo (obligatorio) y una observación si aplica.</li>
          <li>Habla con el administrador encargado para que gestione tu solicitud: él decide si asigna un reemplazo, le propone otra fecha al docente o cancela la reserva.</li>
          <li>Sigue el estado en <strong>Reasignaciones</strong>. Mientras no se resuelva, la franja sigue siendo tuya: no la sueltan ni te la quitan.</li>
        </ol>
        <p className="text-xs text-gray-500">
          Si te vas de vacaciones, te incapacitas o cambia tu horario, también es con el administrador:
          él registra las excepciones y tu disponibilidad semanal.
        </p>
      </Seccion>

      <Seccion titulo="Mi disponibilidad">
        <p>
          Es de <strong>solo consulta</strong>: muestra tu horario semanal oficial y tus excepciones
          vigentes. La Biblioteca la administra; para cualquier cambio contacta al administrador.
        </p>
      </Seccion>

      <Seccion titulo="Qué entra y qué no entra en tus manos">
        <SiNo
          si={[
            "Ver tu calendario, formaciones, asistentes y exportar asistencia a Excel",
            "Solicitar reasignación por calamidad y hacerle seguimiento",
            "Consultar tu disponibilidad y tus estadísticas de satisfacción",
            "Mostrar el QR a los asistentes el día de la formación",
          ]}
          no={[
            "Cancelar o cambiar la fecha de una reserva: lo decide el administrador (o el docente con su enlace)",
            "Modificar tu disponibilidad o registrar excepciones: las gestiona el administrador",
            "Crear cursos, cuentas o tocar la configuración del sistema",
            "Escoger qué formaciones te asignan: el motor las reparte por menor ocupación",
          ]}
        />
      </Seccion>
    </>
  );
}

export function ManualUsuario({ abierto, onClose, rol }: Props) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onClose]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Manual de usuario"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Manual de usuario</h2>
            <p className="text-xs text-gray-500">Guía de SIBER para el rol {NOMBRE_ROL[rol]}</p>
          </div>
          <button
            onClick={onClose} aria-label="Cerrar manual"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-lg text-gray-500 transition hover:bg-gray-50"
          >
            ×
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {rol === "FORMADOR" ? <ManualFormador /> : <ManualAdmin superAdmin={rol === "SUPER_ADMIN"} />}
        </div>
      </div>
    </div>
  );
}
