import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { resetDb, prisma, crearCurso, crearCuenta, crearReservaDirecta } from "./helpers";
import { crearApp } from "../../src/app";
import { DateTime } from "luxon";

const app = crearApp();

async function loginSuper() {
  await crearCuenta({ usuario: "super", correo: "s@t.co", rol: "SUPER_ADMIN" });
  const a = request.agent(app);
  await a.post("/api/v1/auth/login").send({ usuario: "super", password: "Test1234!abcd" });
  return a;
}

beforeAll(resetDb);
beforeEach(resetDb);

describe("Creación de cuentas con cursos asignados", () => {
  it("FORMADOR + cursoIds crea la cuenta, el formador y sus FormadorCurso", async () => {
    const a = await loginSuper();
    const c1 = await crearCurso("Excel");
    const c2 = await crearCurso("Word");
    const r = await a.post("/api/v1/admin/cuentas").send({
      usuario: "formador1", correo: "f1@t.co", password: "1234567890ab",
      nombreCompleto: "Formador Uno", rol: "FORMADOR", cursoIds: [c1.id, c2.id],
    });
    expect(r.status).toBe(201);

    const cuenta = await prisma.cuenta.findUniqueOrThrow({
      where: { usuario: "formador1" },
      include: { formador: { include: { cursos: true } } },
    });
    expect(cuenta.formador).not.toBeNull();
    expect(cuenta.formador!.cursos.map(fc => fc.cursoId).sort()).toEqual([c1.id, c2.id].sort());
  });

  it("cursoId inexistente rechaza con 400 y no crea nada", async () => {
    const a = await loginSuper();
    const r = await a.post("/api/v1/admin/cuentas").send({
      usuario: "formador2", correo: "f2@t.co", password: "1234567890ab",
      nombreCompleto: "Formador Dos", rol: "FORMADOR", cursoIds: ["curso-falso-123"],
    });
    expect(r.status).toBe(400);
    expect(await prisma.cuenta.count({ where: { usuario: "formador2" } })).toBe(0);
  });

  it("cursoIds con rol que no es FORMADOR se ignoran (no hay filas FormadorCurso)", async () => {
    const a = await loginSuper();
    const c = await crearCurso("PowerPoint");
    const r = await a.post("/api/v1/admin/cuentas").send({
      usuario: "admin2", correo: "a2@t.co", password: "1234567890ab",
      nombreCompleto: "Admin Dos", rol: "ADMIN", cursoIds: [c.id],
    });
    expect(r.status).toBe(201);
    const cuenta = await prisma.cuenta.findUniqueOrThrow({
      where: { usuario: "admin2" }, include: { formador: true },
    });
    expect(cuenta.formador).toBeNull();
    expect(await prisma.formadorCurso.count()).toBe(0);
  });
});

describe("Edición de cuentas", () => {
  it("actualiza nombre, correo, contraseña y sincroniza cursos", async () => {
    const a = await loginSuper();
    const c1 = await crearCurso("Excel");
    const c2 = await crearCurso("Word");
    const original = await crearCuenta({ usuario: "f3", correo: "f3@t.co", rol: "FORMADOR" });
    await prisma.formadorCurso.create({ data: { formadorId: original.formador!.id, cursoId: c1.id } });

    const r = await a.put(`/api/v1/admin/cuentas/${original.id}`).send({
      nombreCompleto: "Nombre Editado", correo: "nuevo@t.co",
      password: "nuevaClave123", rol: "FORMADOR", cursoIds: [c2.id],
    });
    expect(r.status).toBe(200);

    const cuenta = await prisma.cuenta.findUniqueOrThrow({
      where: { id: original.id }, include: { formador: { include: { cursos: true } } },
    });
    expect(cuenta.nombreCompleto).toBe("Nombre Editado");
    expect(cuenta.correo).toBe("nuevo@t.co");
    expect(cuenta.formador!.cursos.map(fc => fc.cursoId)).toEqual([c2.id]);

    // La contraseña nueva sirve para entrar
    const login = await request(app).post("/api/v1/auth/login").send({ usuario: "f3", password: "nuevaClave123" });
    expect(login.status).toBe(200);
  });

  it("un ADMIN no puede editar cuentas de administradores", async () => {
    await crearCuenta({ usuario: "adminx", correo: "ax@t.co", rol: "ADMIN" });
    const target = await crearCuenta({ usuario: "adminy", correo: "ay@t.co", rol: "ADMIN" });
    const a = request.agent(app);
    await a.post("/api/v1/auth/login").send({ usuario: "adminx", password: "Test1234!abcd" });
    const r = await a.put(`/api/v1/admin/cuentas/${target.id}`).send({ nombreCompleto: "Hackeado" });
    expect(r.status).toBe(403);
  });

  it("cambiar FORMADOR a ADMIN con reservas futuras es rechazado", async () => {
    const a = await loginSuper();
    const cuenta = await crearCuenta({ usuario: "f4", correo: "f4@t.co", rol: "FORMADOR" });
    const curso = await crearCurso("Zoom");
    await prisma.formadorCurso.create({ data: { formadorId: cuenta.formador!.id, cursoId: curso.id } });
    const inicio = DateTime.now().plus({ days: 3 }).set({ hour: 10 });
    await crearReservaDirecta({ formadorId: cuenta.formador!.id, cursoId: curso.id, inicio, fin: inicio.plus({ hours: 1 }) });

    const r = await a.put(`/api/v1/admin/cuentas/${cuenta.id}`).send({ rol: "ADMIN" });
    expect(r.status).toBe(409);
    const sigue = await prisma.cuenta.findUniqueOrThrow({ where: { id: cuenta.id } });
    expect(sigue.rol).toBe("FORMADOR");
  });
});
