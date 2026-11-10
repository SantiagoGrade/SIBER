import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { resetDb, prisma, crearCurso, crearFormador, crearCuenta, crearReservaDirecta, SEMANA_COMPLETA, proximoDia } from "./helpers";
import { crearApp } from "../../src/app";
import { generarToken, hashToken } from "../../src/utils/tokens";
import { DateTime } from "luxon";

const app = crearApp();
const agent = () => request.agent(app);

async function login(usuario: string, password = "Test1234!abcd") {
  const a = agent();
  const r = await a.post("/api/v1/auth/login").send({ usuario, password });
  return { agent: a, res: r };
}

beforeAll(resetDb);
beforeEach(resetDb);

describe("Seguridad y autorización", () => {
  it("endpoints protegidos rechazan acceso sin autenticación", async () => {
    const res = await Promise.all([
      request(app).get("/api/v1/admin/reservas"),
      request(app).get("/api/v1/admin/estadisticas"),
      request(app).get("/api/v1/formador/reservas"),
      request(app).post("/api/v1/admin/cursos").send({ nombre: "X" }),
    ]);
    for (const r of res) expect(r.status).toBe(401);
  });

  it("un FORMADOR no puede usar endpoints administrativos", async () => {
    await crearFormador({ usuario: "f1", correo: "f1@t.co", franjas: SEMANA_COMPLETA });
    const { agent: a } = await login("f1");
    const r = await a.get("/api/v1/admin/reservas");
    expect(r.status).toBe(403);
    const r2 = await a.post("/api/v1/admin/cursos").send({ nombre: "Curso X" });
    expect(r2.status).toBe(403);
  });

  it("un ADMIN no puede crear administradores", async () => {
    await crearCuenta({ usuario: "admin1", correo: "a1@t.co", rol: "ADMIN" });
    const { agent: a } = await login("admin1");
    const r = await a.post("/api/v1/admin/cuentas").send({
      usuario: "evil", correo: "e@t.co", password: "1234567890ab",
      nombreCompleto: "Evil", rol: "ADMIN",
    });
    expect(r.status).toBe(403);
  });

  it("SUPER_ADMIN sí puede crear administradores", async () => {
    await crearCuenta({ usuario: "super", correo: "s@t.co", rol: "SUPER_ADMIN" });
    const { agent: a } = await login("super");
    const r = await a.post("/api/v1/admin/cuentas").send({
      usuario: "nuevoadmin", correo: "n@t.co", password: "1234567890ab",
      nombreCompleto: "Nuevo Admin", rol: "ADMIN",
    });
    expect(r.status).toBe(201);
  });

  it("un formador no puede consultar asistentes de reserva ajena", async () => {
    const curso = await crearCurso();
    const f1 = await crearFormador({ usuario: "f1", correo: "f1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
    const f2 = await crearFormador({ usuario: "f2", correo: "f2@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
    const { inicio, fin } = proximoDia(2, 10, 60);
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin });

    const { agent: a } = await login("f2");
    const r = await a.get(`/api/v1/formador/reservas/${reserva.id}/asistentes`);
    expect(r.status).toBe(403);
    // El propietario sí puede
    const { agent: b } = await login("f1");
    expect((await b.get(`/api/v1/formador/reservas/${reserva.id}/asistentes`)).status).toBe(200);
  });

  it("login con credenciales incorrectas es 401 y no revela si el usuario existe", async () => {
    await crearCuenta({ usuario: "u1", correo: "u1@t.co", rol: "ADMIN" });
    const r1 = await request(app).post("/api/v1/auth/login").send({ usuario: "u1", password: "mala" });
    const r2 = await request(app).post("/api/v1/auth/login").send({ usuario: "noexiste", password: "mala" });
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r1.body.error).toBe(r2.body.error); // mismo mensaje (anti-enumeración)
  });

  it("recuperación de contraseña informa si el correo no está registrado", async () => {
    await crearCuenta({ usuario: "u1", correo: "u1@t.co", rol: "ADMIN" });
    const r1 = await request(app).post("/api/v1/auth/recuperar").send({ correo: "u1@t.co" });
    const r2 = await request(app).post("/api/v1/auth/recuperar").send({ correo: "nadie@t.co" });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(404);
    expect(r2.body.error).toMatch(/no existe una cuenta/i);
  });

  it("entradas maliciosas en validación son rechazadas", async () => {
    // documento con inyección
    const r = await request(app).post("/api/v1/publico/asistencia/xxxtoken").send({
      nombreCompleto: "A'; DROP TABLE usuarios; --",
      documento: "1'; DROP--",
      correo: "e@t.co", programaAcademicoId: "x",
      evaluacion: { calificacionGeneral: 5 },
    });
    expect([400, 404]).toContain(r.status);
    // payload enorme rechazado
    const r2 = await request(app).post("/api/v1/publico/reservas").send({ cursoId: "x".repeat(10000) });
    expect(r2.status).toBe(400);
  });

  it("la disponibilidad pública no expone datos personales", async () => {
    const curso = await crearCurso();
    await crearFormador({ usuario: "f1", correo: "f1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
    const r = await request(app).get("/api/v1/publico/disponibilidad").query({
      cursoId: curso.id,
      desde: new Date(Date.now() + 86400000).toISOString(),
      hasta: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
    expect(r.status).toBe(200);
    const texto = JSON.stringify(r.body);
    expect(texto).not.toContain("f1@t.co");
    expect(texto).not.toContain("nombreCompleto");
    expect(texto).not.toContain("formador");
  });

  it("la confirmación de reserva pública no devuelve identificadores internos", async () => {
    const curso = await crearCurso();
    await crearFormador({ usuario: "f1", correo: "f1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
    const { inicio, fin } = proximoDia(2, 10, 60);
    const r = await request(app).post("/api/v1/publico/reservas").send({
      docenteNombre: "Docente Público", docenteCorreo: "doc@t.co",
      cursoId: curso.id, iniciaAt: inicio.toISO(), terminaAt: fin.toISO(),
    });
    expect(r.status).toBe(201);
    expect(r.body.codigo).toMatch(/^SIF-/);
    expect(JSON.stringify(r.body)).not.toContain("formadorId");
    expect(JSON.stringify(r.body)).not.toContain("cm"); // no cuid interno
  });
});
