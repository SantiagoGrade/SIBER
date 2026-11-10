/**
 * Entorno de pruebas de integración.
 * IMPORTANTE: este módulo debe ser el primer import de cada test de integración;
 * la cadena helpers → setup → process.env → prisma garantiza que el cliente
 * Prisma se construya apuntando a la base de datos de pruebas.
 */
import { asegurarEsquema } from "./setup"; // primero: configura process.env
import { prisma } from "../../src/repositories/prisma";
import argon2 from "argon2";
import { DateTime } from "luxon";
import { generarToken, hashToken, cifrarToken } from "../../src/utils/tokens";
import { ZONA } from "../../src/config/env";

export { prisma, asegurarEsquema };
asegurarEsquema();

/** Limpia todas las tablas entre tests. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RegistroIntentoQr","EvaluacionFormacion","Asistencia","RegistroQrFormacion",
      "TokenSeguro","PropuestaFecha","SolicitudReasignacion","HistorialReserva",
      "Notificacion","Reserva","FormadorCurso","DisponibilidadSemanal",
      "ExcepcionDisponibilidad","Curso","Formador","Facultad","ProgramaAcademico",
      "ConfiguracionSistema","Cuenta"
    RESTART IDENTITY CASCADE
  `);
}

export async function crearCuenta(params: {
  usuario: string; correo: string; rol: "SUPER_ADMIN" | "ADMIN" | "FORMADOR";
  nombre?: string; activo?: boolean;
}) {
  return prisma.cuenta.create({
    data: {
      usuario: params.usuario,
      correo: params.correo,
      passwordHash: await argon2.hash("Test1234!abcd", { type: argon2.argon2id }),
      rol: params.rol,
      nombreCompleto: params.nombre ?? params.usuario,
      activo: params.activo ?? true,
      ...(params.rol === "FORMADOR" ? { formador: { create: {} } } : {}),
    },
    include: { formador: true },
  });
}

export async function crearCurso(nombre = "Curso de prueba") {
  return prisma.curso.create({ data: { nombre, activo: true } });
}

export async function crearFormador(params: {
  usuario: string; correo: string; activo?: boolean;
  franjas?: { diaSemana: number; horaInicio: number; horaFin: number }[];
  cursoIds?: string[];
}) {
  const cuenta = await crearCuenta({
    usuario: params.usuario, correo: params.correo, rol: "FORMADOR",
    activo: params.activo ?? true,
  });
  const fid = cuenta.formador!.id;
  if (params.franjas?.length) {
    await prisma.disponibilidadSemanal.createMany({
      data: params.franjas.map(f => ({ formadorId: fid, ...f })),
    });
  }
  if (params.cursoIds?.length) {
    await prisma.formadorCurso.createMany({
      data: params.cursoIds.map(cursoId => ({ formadorId: fid, cursoId })),
    });
  }
  return { cuenta, formadorId: fid };
}

/** Lunes a viernes 8:00-17:00 en minutos */
export const SEMANA_COMPLETA = [1, 2, 3, 4, 5].map(diaSemana => ({
  diaSemana, horaInicio: 8 * 60, horaFin: 17 * 60,
}));

/** Próximo día de semana `weekday` a las `hora`:00 (Bogotá) + duración en minutos */
export function proximoDia(weekday: number, hora = 10, minutos = 60) {
  let d = DateTime.now().setZone(ZONA).startOf("day").plus({ days: 7 }).set({ hour: hora, minute: 0 });
  while (d.weekday !== weekday) d = d.plus({ days: 1 });
  return { inicio: d, fin: d.plus({ minutes: minutos }) };
}

/**
 * Próximo intervalo dentro de SEMANA_COMPLETA (lun–vie 8–17) con al menos
 * `anticipacionHoras` de anticipación. Evita que tests dependan del momento
 * en que se ejecutan.
 */
export function proximoHorarioCubierto(duracionHoras = 1, anticipacionHoras = 50) {
  let d = DateTime.now().setZone(ZONA).plus({ hours: anticipacionHoras }).startOf("hour");
  while (d.weekday > 5 || d.hour < 8 || d.hour + duracionHoras > 17) {
    d = d.plus({ days: 1 }).startOf("day").set({ hour: 8 });
  }
  return { inicio: d, fin: d.plus({ hours: duracionHoras }) };
}

export async function crearReservaDirecta(params: {
  cursoId: string; formadorId: string; inicio: DateTime; fin: DateTime;
  estado?: "CONFIRMADA" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
  docenteCorreo?: string;
  docenteNombre?: string;
  docenteTelefono?: string;
  aula?: string;
}) {
  return prisma.reserva.create({
    data: {
      codigo: `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      cursoId: params.cursoId,
      formadorId: params.formadorId,
      docenteNombre: params.docenteNombre ?? "Docente Test",
      docenteCorreo: params.docenteCorreo ?? "docente@test.local",
      docenteTelefono: params.docenteTelefono ?? null,
      aula: params.aula ?? null,
      iniciaAt: params.inicio.toJSDate(),
      terminaAt: params.fin.toJSDate(),
      estado: params.estado ?? "CONFIRMADA",
    },
  });
}

/** Registra el QR de una reserva (simula lo que hace programarQrPara) */
export async function crearQrPara(reservaId: string, inicio: DateTime, opts?: {
  envioProgramado?: DateTime; estadoEnvio?: "PENDIENTE" | "ENVIADO";
}) {
  const token = generarToken();
  const qr = await prisma.registroQrFormacion.create({
    data: {
      reservaId,
      tokenHash: hashToken(token),
      tokenCifrado: cifrarToken(token),
      estado: "PROGRAMADO",
      estadoEnvio: opts?.estadoEnvio ?? "PENDIENTE",
      fechaHabilitacion: inicio.plus({ minutes: 30 }).toJSDate(),
      fechaCierre: inicio.plus({ minutes: 240 }).toJSDate(),
      fechaEnvioProgramado: (opts?.envioProgramado ?? inicio.plus({ minutes: 30 })).toJSDate(),
    },
  });
  return { qr, token };
}
