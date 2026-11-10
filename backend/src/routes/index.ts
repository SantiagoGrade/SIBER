import { Router } from "express";
import { autenticar, soloAdmins, soloFormador, cualquierAutenticado } from "../middleware/auth";
import { validar, limitadorLogin, limitadorPublico, limitadorEscritura } from "../middleware/validate";
import * as s from "../validators/schemas";
import * as auth from "../controllers/auth.controller";
import * as pub from "../controllers/publico.controller";
import * as adm from "../controllers/admin.controller";
import * as frm from "../controllers/formador.controller";

export const router = Router();

// ── Auth ──
router.post("/auth/login", limitadorLogin, validar(s.loginSchema), auth.login);
router.post("/auth/logout", auth.logout);
router.get("/auth/perfil", autenticar, auth.perfil);
router.post("/auth/cambiar-password", autenticar, validar(s.cambiarPasswordSchema), auth.cambiarPasswordCtrl);
router.post("/auth/recuperar", limitadorPublico, validar(s.recuperarSchema), auth.recuperar);
router.post("/auth/restablecer", limitadorPublico, validar(s.restablecerSchema), auth.restablecer);

// ── Público ──
router.get("/publico/cursos", limitadorPublico, pub.cursosActivos);
router.get("/publico/facultades", limitadorPublico, pub.facultadesActivas);
router.get("/publico/programas", limitadorPublico, pub.programasActivos);

router.get("/publico/disponibilidad", limitadorPublico, validar(s.disponibilidadPublicaQuery, "query"), pub.disponibilidadPublica);
router.post("/publico/reservas", limitadorEscritura, validar(s.solicitudReservaSchema), pub.crearReservaPublica);
router.get("/publico/cancelacion", limitadorPublico, pub.previaCancelacion);
router.post("/publico/cancelacion", limitadorEscritura, validar(s.cancelarReservaSchema), pub.ejecutarCancelacion);
router.get("/publico/propuesta", limitadorPublico, pub.previaPropuesta);
router.post("/publico/propuesta", limitadorEscritura, validar(s.responderPropuestaSchema), pub.responderPropuesta);
router.get("/publico/asistencia/:token", limitadorPublico, pub.resolverQr);
router.post("/publico/asistencia/:token", limitadorEscritura, validar(s.asistenciaSchema), pub.enviarAsistencia);

// ── Admin ──
const admin = Router();
admin.use(autenticar, soloAdmins);
admin.get("/cuentas", adm.listarCuentas);
admin.post("/cuentas", validar(s.crearCuentaSchema), adm.crearCuentaCtrl);
admin.put("/cuentas/:id", validar(s.actualizarCuentaSchema), adm.actualizarCuentaCtrl);
admin.post("/cuentas/:id/desactivar", adm.desactivarCuentaCtrl);
admin.post("/cuentas/:id/activar", adm.activarCuentaCtrl);
admin.get("/formadores", adm.formadoresLista);
admin.get("/formadores/:id/disponibilidad", adm.disponibilidadDe);
admin.put("/formadores/:id/disponibilidad", validar(s.disponibilidadSchema), adm.establecerDisponibilidadCtrl);
admin.get("/formadores/:id/excepciones", adm.excepcionesDe);
admin.post("/formadores/:id/excepciones", validar(s.excepcionSchema), adm.crearExcepcionCtrl);
admin.delete("/formadores/:id/excepciones/:excepcionId", adm.eliminarExcepcionCtrl);
admin.get("/cursos", adm.listarCursos);
admin.post("/cursos", validar(s.crearCursoSchema), adm.crearCursoCtrl);
admin.put("/cursos/:id", validar(s.actualizarCursoSchema), adm.actualizarCursoCtrl);
admin.post("/cursos/:id/formadores", validar(s.habilitarFormadorSchema), adm.habilitarCtrl);
admin.delete("/cursos/:id/formadores/:formadorId", adm.deshabilitarCtrl);

admin.get("/reservas", validar(s.filtroEstadisticasSchema, "query"), adm.listarReservas);
admin.get("/reservas/:id", adm.detalleReserva);
admin.post("/reservas/:id/cancelar", validar(s.cancelarAdminSchema), adm.cancelarReservaAdmin);
admin.get("/reservas/:id/asistentes", adm.asistentesReserva);
admin.get("/reservas/:id/qr", adm.qrDeReserva);
admin.post("/reservas/:id/qr/cerrar", adm.cerrarQrCtrl);
admin.post("/reservas/:id/qr/abrir", adm.abrirQrCtrl);
admin.get("/reasignaciones", adm.listarReasignaciones);
admin.get("/reasignaciones/:id/reemplazos", adm.reemplazosCtrl);
admin.get("/reasignaciones/:id/alternativas", adm.alternativasCtrl);
admin.post("/reasignaciones/:id/aprobar", validar(s.aprobarReasignacionSchema), adm.aprobarCtrl);
admin.post("/reasignaciones/:id/rechazar", validar(s.rechazarReasignacionSchema), adm.rechazarCtrl);
admin.post("/reasignaciones/:id/sin-reemplazo", adm.sinReemplazoCtrl);
admin.post("/reasignaciones/:id/proponer-fecha", validar(s.propuestaFechaSchema), adm.proponerFechaCtrl);
admin.get("/estadisticas", validar(s.filtroEstadisticasSchema, "query"), adm.statsAdmin);
admin.get("/exportar/:tipo", adm.exportarCtrl);
admin.get("/configuracion/:clave", adm.leerConfig);
admin.put("/configuracion", validar(s.configSchema), adm.escribirConfig);
router.use("/admin", admin);

// ── Formador ──
const formador = Router();
formador.use(autenticar, soloFormador);
formador.get("/calendario", frm.miCalendario);
formador.get("/reservas", validar(s.filtroEstadisticasSchema, "query"), frm.misReservas);
formador.get("/disponibilidad", frm.miDisponibilidad);
formador.get("/dashboard", validar(s.filtroEstadisticasSchema, "query"), frm.miDashboard);
formador.post("/reasignaciones", validar(s.reasignacionSchema), frm.solicitarReasignacionCtrl);
formador.get("/reasignaciones", frm.misReasignaciones);
formador.get("/reservas/:id/asistentes", frm.asistentesMios);
formador.get("/reservas/:id/asistentes/exportar", frm.exportarAsistenciaMia);
router.use("/formador", formador);

// Salud
router.get("/health", (_req, res) => res.json({ ok: true, servicio: "sifoin" }));
