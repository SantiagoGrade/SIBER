# Modelo de datos

PostgreSQL 16 vía Prisma (`backend/prisma/schema.prisma`). Migraciones versionadas en `prisma/migrations/`.

## Entidades

| Tabla | Claves / restricciones destacadas |
|---|---|
| `Cuenta` | `usuario`, `correo` únicos; `rol` enum; `passwordHash` Argon2id |
| `Formador` | 1:1 `cuentaId`; relaciones a cursos, disponibilidad, excepciones, reservas |
| `Curso` | `nombre` único, `activo` |
| `FormadorCurso` | PK compuesta (formadorId, cursoId), cascada |
| `DisponibilidadSemanal` | `diaSemana` 1–7, `horaInicio/horaFin` minutos |
| `ExcepcionDisponibilidad` | `tipo` enum, rango `iniciaAt–terminaAt` |
| `Facultad` | `nombre` único, `activo`; catálogo fijo, referenciada por `Reserva` |
| `ProgramaAcademico` | `nombre` único, `activo`; catálogo fijo, requerido por `Asistencia` |
| `Reserva` | `codigo` único, `idempotencyKey` único nullable, **exclusion constraint** `excl_solape_formador` (formadorId `=` + `tsrange` `&&`, solo CONFIRMADA/EN_CURSO/FINALIZADA) |
| `HistorialReserva` | evento + detalle JSON + actor |
| `SolicitudReasignacion` | estado enum, `reemplazoSugeridoId`, `gestionadaPorId` |
| `PropuestaFecha` | estado PENDIENTE/ACEPTADA/RECHAZADA |
| `TokenSeguro` | `hash` único SHA-256, `tipo` enum, `expiraAt`, `usadoAt` |
| `Asistencia` | `@@unique(reservaId, documento)`, `programaAcademicoId` requerido, `aceptaTratamiento` (legado, ya no se solicita) |
| `EvaluacionFormacion` | `asistenciaId` único (1:1), nota 1–5, `observaciones` |
| `RegistroQrFormacion` | `reservaId` único, `tokenHash` único, `tokenCifrado` AES-GCM, `estado` QR (PROGRAMADO/ABIERTO/CERRADO/INVALIDADO), ventana `fechaHabilitacion–fechaCierre`, `fechaEnvioProgramado/Real`, `estadoEnvio`, `destinatario`, `intentosEnvio`, `ultimoError` |
| `RegistroIntentoQr` | registro de accesos inválidos al QR |
| `Notificacion` | outbox: `dedupKey` único, `estado`, `intentos`, `programadaPara` |
| `ConfiguracionSistema` | clave → valor JSON (umbrales configurables) |

## Índices principales
- `Reserva`: (formadorId, estado, iniciaAt), (estado, iniciaAt), (cursoId, estado), (docenteCorreo).
- `RegistroQrFormacion`: (estadoEnvio, fechaEnvioProgramado) — el job consulta por esa vía.
- `Notificacion`: (estado, programadaPara).
- GIST `excl_solape_formador` con `btree_gist`.

## Convención temporal
`timestamp` guarda instantes reales (UTC). `DisponibilidadSemanal` usa (día, minutos) interpretados en `America/Bogota`. `tsrange` se usa en la exclusión porque `tstzrange` sobre `timestamp without tz` es STABLE y Postgres lo rechaza en índices.
