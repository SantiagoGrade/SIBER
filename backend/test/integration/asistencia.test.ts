import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { resetDb, prisma, crearCurso, crearFormador, crearReservaDirecta, crearQrPara, SEMANA_COMPLETA } from "./helpers";
import { registrarAsistenciaYEvaluacion, asistentesDe } from "../../src/services/asistencia.service";
import { DateTime } from "luxon";
import { ZONA } from "../../src/config/env";
import { generarToken, hashToken, cifrarToken } from "../../src/utils/tokens";

beforeAll(resetDb);
beforeEach(resetDb);

async function escenario(minutosDesdeInicio = -60, docenteCorreo = "docente@test.local") {
  const suf = Math.random().toString(36).slice(2, 8);
  const curso = await crearCurso(`Curso-${suf}`);
  const f = await crearFormador({ usuario: `f-${suf}`, correo: `f-${suf}@t.co`, franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  const programa = await prisma.programaAcademico.create({ data: { nombre: `Licenciatura-${suf}` } });
  const inicio = DateTime.now().setZone(ZONA).plus({ minutes: minutosDesdeInicio });
  const reserva = await crearReservaDirecta({
    cursoId: curso.id, formadorId: f.formadorId, inicio, fin: inicio.plus({ hours: 4 }),
    docenteCorreo,
  });
  const { token } = await crearQrPara(reserva.id, inicio);
  return { curso, f, programa, reserva, token, inicio };
}

const evalOk = {
  contenidoObjetivo: 5, metodologiaAdecuada: 4,
  dominioTema: 5, coherenciaExposicion: 4,
  calificacionGeneral: 5, observaciones: "Muy buena la dinámica",
};

function input(token: string, programaId: string, documento = "12345678", correo = "estudiante@t.co") {
  return {
    token, nombreCompleto: "Estudiante Uno", documento,
    correo, programaAcademicoId: programaId,
    evaluacion: { ...evalOk },
  };
}

describe("Registro de asistencia + evaluación", () => {
  it("registro válido vincula asistencia y evaluación a la formación", async () => {
    const { token, programa, reserva } = await escenario();
    const r = await registrarAsistenciaYEvaluacion(input(token, programa.id));
    const asistencia = await prisma.asistencia.findUniqueOrThrow({
      where: { id: r.asistenciaId }, include: { evaluacion: true },
    });
    expect(asistencia.reservaId).toBe(reserva.id);
    expect(asistencia.evaluacion!.calificacionGeneral).toBe(5);
    expect(asistencia.evaluacion!.contenidoObjetivo).toBe(5);
    expect(asistencia.evaluacion!.metodologiaAdecuada).toBe(4);
    expect(asistencia.evaluacion!.dominioTema).toBe(5);
    expect(asistencia.evaluacion!.coherenciaExposicion).toBe(4);
    expect(asistencia.evaluacion!.reservaId).toBe(reserva.id);
  });

  it("documento duplicado en la misma formación es rechazado", async () => {
    const { token, programa } = await escenario();
    await registrarAsistenciaYEvaluacion(input(token, programa.id, "123"));
    await expect(registrarAsistenciaYEvaluacion(input(token, programa.id, "123")))
      .rejects.toMatchObject({ status: 409 });
    expect(await prisma.asistencia.count()).toBe(1);
    expect(await prisma.evaluacionFormacion.count()).toBe(1);
  });

  it("el mismo documento sí puede registrarse en OTRA formación", async () => {
    const a = await escenario();
    const b = await escenario();
    await registrarAsistenciaYEvaluacion(input(a.token, a.programa.id, "999"));
    const r = await registrarAsistenciaYEvaluacion(input(b.token, b.programa.id, "999"));
    expect(r.asistenciaId).toBeTruthy();
    expect(await prisma.asistencia.count()).toBe(2);
  });

  it("calificaciones fuera del rango 1-5 son rechazadas en cualquier aspecto", async () => {
    const { token, programa } = await escenario();
    const campos = ["calificacionGeneral", "contenidoObjetivo", "metodologiaAdecuada", "dominioTema", "coherenciaExposicion"] as const;
    let n = 0;
    for (const campo of campos) {
      for (const valor of [0, 6, -1, 2.5]) {
        const inp = input(token, programa.id, "d" + n++);
        (inp.evaluacion as unknown as Record<string, number>)[campo] = valor;
        await expect(registrarAsistenciaYEvaluacion(inp)).rejects.toMatchObject({ status: 400 });
      }
    }
    expect(await prisma.asistencia.count()).toBe(0);
  });

  it("marca esDocente cuando el correo coincide con el del docente solicitante", async () => {
    const { token, programa, reserva } = await escenario(-60, "Docente@Test.Local");
    const rDoc = await registrarAsistenciaYEvaluacion(
      input(token, programa.id, "111", "  DOCENTE@test.local  "),
    );
    const rAsis = await registrarAsistenciaYEvaluacion(
      input(token, programa.id, "222", "otro@t.co"),
    );
    const docente = await prisma.asistencia.findUniqueOrThrow({ where: { id: rDoc.asistenciaId } });
    const asistente = await prisma.asistencia.findUniqueOrThrow({ where: { id: rAsis.asistenciaId } });
    expect(docente.esDocente).toBe(true);
    expect(asistente.esDocente).toBe(false);
    const lista = await asistentesDe(reserva.id);
    expect(lista.find(a => a.documento === "111")!.esDocente).toBe(true);
  });

  it("token QR inválido es rechazado y el intento queda registrado", async () => {
    const { programa } = await escenario();
    await expect(registrarAsistenciaYEvaluacion(input("token-falso", programa.id)))
      .rejects.toMatchObject({ status: 404 });
    expect(await prisma.registroIntentoQr.count()).toBe(1);
  });

  it("registro cerrado es rechazado", async () => {
    const { token, programa, reserva } = await escenario();
    await prisma.registroQrFormacion.updateMany({ where: { reservaId: reserva.id }, data: { estado: "CERRADO" } });
    await expect(registrarAsistenciaYEvaluacion(input(token, programa.id)))
      .rejects.toMatchObject({ status: 400 });
  });

  it("registro antes de habilitarse es rechazado", async () => {
    const { token, programa } = await escenario(+120); // inicia en 2h → habilita en 2.5h
    await expect(registrarAsistenciaYEvaluacion(input(token, programa.id)))
      .rejects.toMatchObject({ status: 400 });
  });

  it("programa académico inválido es rechazado", async () => {
    const { token } = await escenario();
    await expect(registrarAsistenciaYEvaluacion(input(token, "no-existe")))
      .rejects.toMatchObject({ status: 400 });
  });

  it("lista de asistentes incluye la evaluación", async () => {
    const { token, programa, reserva } = await escenario();
    await registrarAsistenciaYEvaluacion(input(token, programa.id));
    const lista = await asistentesDe(reserva.id);
    expect(lista).toHaveLength(1);
    expect(lista[0].programa).toContain("Licenciatura");
    expect(lista[0].evaluacion!.calificacionGeneral).toBe(5);
    expect(lista[0].evaluacion!.contenidoObjetivo).toBe(5);
    expect(lista[0].evaluacion!.dominioTema).toBe(5);
    expect(lista[0].evaluacion!.observaciones).toBe("Muy buena la dinámica");
  });
});
