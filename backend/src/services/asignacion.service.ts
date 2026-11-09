import { prisma, Tx } from "../repositories/prisma";
import { DateTime } from "luxon";
import { cubreIntervalo, cargaSemanal } from "./disponibilidad.service";

type Db = typeof prisma | Tx;

export interface Candidato {
  formadorId: string;
  nombre: string;
  correo: string;
  minutosDisponibles: number;
  minutosOcupados: number;
  ocupacion: number;
}

/**
 * Motor de asignación: devuelve los formadores elegibles para impartir `cursoId`
 * en [inicio, fin), ordenados por:
 *   1) menor porcentaje de ocupación semanal,
 *   2) menor cantidad de horas ocupadas,
 *   3) id del formador (criterio estable, reproducible).
 */
export async function candidatosPara(
  db: Db,
  cursoId: string,
  inicio: DateTime,
  fin: DateTime,
  excluirFormadorId?: string
): Promise<Candidato[]> {
  const habilitados = await db.formadorCurso.findMany({
    where: { cursoId, formador: { cuenta: { activo: true } } },
    include: { formador: { include: { cuenta: true } } },
  });

  const candidatos: Candidato[] = [];
  for (const fc of habilitados) {
    const f = fc.formador;
    if (excluirFormadorId && f.id === excluirFormadorId) continue;
    const cubre = await cubreIntervalo(db, f.id, inicio, fin);
    if (!cubre) continue;
    const carga = await cargaSemanal(db, f.id, inicio);
    candidatos.push({
      formadorId: f.id,
      nombre: f.cuenta.nombreCompleto,
      correo: f.cuenta.correo,
      minutosDisponibles: carga.minutosDisponibles,
      minutosOcupados: carga.minutosOcupados,
      ocupacion: carga.ocupacion,
    });
  }

  candidatos.sort((a, b) =>
    a.ocupacion - b.ocupacion ||
    a.minutosOcupados - b.minutosOcupados ||
    a.formadorId.localeCompare(b.formadorId)
  );
  return candidatos;
}

/** Mejor candidato (o null si nadie es elegible). */
export async function mejorCandidato(
  db: Db, cursoId: string, inicio: DateTime, fin: DateTime, excluirFormadorId?: string
): Promise<Candidato | null> {
  const cs = await candidatosPara(db, cursoId, inicio, fin, excluirFormadorId);
  return cs[0] ?? null;
}
