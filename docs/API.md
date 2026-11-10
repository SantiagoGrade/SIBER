# API REST — `/api/v1`

Auth: cookie HttpOnly `siber_sesion` (JWT 8 h). Errores: `{ error, code, detalles? }`.

## Público (sin login, rate limited)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/publico/cursos` `/facultades` `/programas` | Catálogos activos |
| GET | `/publico/disponibilidad?cursoId&desde&hasta` | `{ libres, ocupados, anticipacionMinimaDias }`: unión de franjas efectivas y tramos ya reservados sin cobertura alterna (máx. 62 días) |
| POST | `/publico/reservas` | Crear reserva (anticipación en días de calendario, idempotencyKey; opcionales `docenteTelefono`, `aula`, `facultadId`) |
| GET/POST | `/publico/cancelacion` | Vista previa / ejecutar cancelación por token |
| GET/POST | `/publico/propuesta` | Vista previa / responder propuesta de fecha |
| GET | `/publico/asistencia/:token` | Valida QR y devuelve datos del formulario |
| POST | `/publico/asistencia/:token` | Registra asistencia + evaluación |

## Auth
`POST /auth/login` · `POST /auth/logout` · `GET /auth/perfil` · `POST /auth/cambiar-password` · `POST /auth/recuperar` · `POST /auth/restablecer`

## Admin (SUPER_ADMIN + ADMIN)
- `GET/POST /admin/cuentas`, `PUT /admin/cuentas/:id` (edita usuario/correo/nombre/rol/password opcional; `cursoIds[]` sincroniza cursos del FORMADOR), `POST /admin/cuentas/:id/(des)activar` (admins solo SUPER_ADMIN); `POST` acepta `cursoIds[]`
- `GET/POST/PUT /admin/cursos`, `POST/DELETE /admin/cursos/:id/formadores[/:formadorId]`
- `GET /admin/formadores` (lista con cuenta y cursos habilitados)
- `GET/PUT /admin/formadores/:id/disponibilidad` · `GET/POST/DELETE /admin/formadores/:id/excepciones[/:excepcionId]`

- `GET /admin/reservas` (filtros + `orden=asc|desc` por `iniciaAt`), `GET /admin/reservas/:id`, `POST …/cancelar`, `GET …/asistentes`, `GET …/qr`, `POST …/qr/(cerrar|abrir)`
- `GET /admin/reasignaciones`, `GET …/:id/reemplazos`, `GET …/:id/alternativas`, `POST …/:id/(aprobar|rechazar|sin-reemplazo|proponer-fecha)`
- `GET /admin/estadisticas` (desde,hasta,cursoId,formadorId,facultadId,mes,semestre,anio,estado,orden)
- `GET /admin/exportar/(reservas|estadisticas|asistencia)` → `.xlsx` (`asistencia` requiere `reservaId`)
- `GET /admin/configuracion/:clave` · `PUT /admin/configuracion` `{ clave, valor }`

## Formador
`GET /formador/calendario?desde&hasta` · `GET /formador/reservas` · `GET /formador/disponibilidad` · `GET /formador/dashboard` · `GET/POST /formador/reasignaciones` · `GET /formador/reservas/:id/(asistentes|asistentes/exportar)`

## Salud
`GET /api/v1/health`
