import { env } from "../config/env";
import { procesarOutbox } from "../services/notificacion.service";
import { procesarEnviosQr } from "../services/qr.service";
import { sincronizarEstadosReservas } from "../services/reserva.service";
import { procesarRecordatorios } from "../services/recordatorio.service";

const timers: NodeJS.Timeout[] = [];

function ciclo(nombre: string, ms: number, fn: () => Promise<number>) {
  const ejecutar = async () => {
    try {
      const n = await fn();
      if (n > 0) console.log(`[job:${nombre}] procesados: ${n}`);
    } catch (e) {
      console.error(`[job:${nombre}] error:`, e instanceof Error ? e.message : e);
    }
  };
  ejecutar();
  timers.push(setInterval(ejecutar, ms));
}

/** Arranca los procesos programados persistentes. */
export function iniciarJobs() {
  ciclo("outbox", env.outboxPollMs, procesarOutbox);
  ciclo("qr", env.qrJobPollMs, procesarEnviosQr);
  ciclo("estados-reserva", env.finalizaJobPollMs, sincronizarEstadosReservas);
  ciclo("recordatorios", env.recordatorioJobPollMs, () => procesarRecordatorios());
  console.log("[jobs] iniciados: outbox, qr, estados-reserva, recordatorios");
}

export function detenerJobs() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}
