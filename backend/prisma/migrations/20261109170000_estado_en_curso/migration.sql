-- Nuevo estado EN_CURSO: la reserva está en ejecución
-- (iniciaAt <= ahora < terminaAt). La transición la hace el job de ciclo de vida.
-- El constraint anti-solape se actualiza en la migración siguiente
-- (el nuevo valor del enum debe estar committeado antes de poder usarse).
ALTER TYPE "EstadoReserva" ADD VALUE 'EN_CURSO';
