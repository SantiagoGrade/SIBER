# Identidad visual — Sistema Auditorio

Guía de referencia del frontend actual del Sistema Auditorio del Colegio Mayor de Antioquia. Refleja `FRONTEND/` a septiembre de 2026; sustituye la guía histórica del Sistema de Medios.

---

## 1. Base tecnológica actual

| Tecnología | Uso |
|---|---|
| React 19 + Vite | Interfaz y compilación |
| React Router DOM 7 | Rutas y navegación protegida |
| Tailwind CSS 3 | Utilidades y componentes compartidos |
| Axios | Cliente HTTP |
| react-icons/hi y react-icons/fi | Iconografía |
| Luxon, date-fns y moment-timezone | Fechas y zona horaria |
| react-calendar y react-datepicker | Calendarios y fechas |
| Chart.js + react-chartjs-2 | Gráficas del dashboard |

No se usan Zustand, React Hook Form ni react-toastify. El feedback se presenta dentro de cada vista mediante alertas, validaciones y estados de carga.

## 2. Tokens de color

Configurados en `FRONTEND/tailwind.config.js`:

| Token | Valor | Uso |
|---|---:|---|
| `primary` | `#0A6A50` | Marca, acciones y foco |
| `primary-hover` | `#0A6A70` | Hover de acciones principales |
| `accent` | `#ADE498` | Extremo claro del fondo institucional |

Los neutros de Tailwind estructuran superficies y textos. Estados actuales: pendiente `amber`, aprobado `emerald`, rechazado `red`, cancelado `gray` y finalizado `gray`.

> Hay código heredado con equivalentes literales como `bg-[#0A6A50]`. Es visualmente coherente, pero el código nuevo debe preferir los tokens `primary`, `primary-hover` y `accent`.

## 3. Tipografía

Se usa la pila nativa de sistema de `src/index.css`, sin fuente externa.

| Elemento | Patrón |
|---|---|
| Título de página | `text-2xl font-bold text-primary` (Cuentas usa `text-3xl`) |
| Título de sección | `font-bold text-primary` o `text-lg font-semibold text-primary` |
| Descripción | `mt-0.5 text-sm text-gray-500` |
| Label | `text-sm font-medium text-gray-700` |
| Texto de campo | `text-sm text-gray-800` |
| Encabezado auxiliar | `text-xs font-semibold uppercase tracking-wide text-gray-500` |

## 4. Fondo y layout

Las rutas autenticadas usan el degradado institucional y el `Header`:

```jsx
<div className="flex min-h-screen flex-col bg-gradient-to-b from-primary to-accent">
  <Header />
  <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8" />
</div>
```

`Login` y `ChangePassword` son la excepción intencional: muestran `audi.png` a pantalla completa con un overlay `primary` al 75 % y tarjetas centradas.

## 5. Header y navegación

`components/layout/Header.jsx` es blanco, fijo, con `border-b border-gray-100 shadow-sm` y navegación responsive.

- Logo actual: `public/logo.jpeg`, `h-7 sm:h-9`.
- Nombre: **Colegio Mayor de Antioquia**; subtítulo: **Sistema Auditorio**.
- Navegación según rol, submenús de Calendario y Dashboard y menú hamburguesa bajo `xl`.
- Opción activa en `primary` con texto blanco.
- Cierre de sesión como acción discreta roja.

El header actual no tiene badge de usuario; no es un requisito de esta guía.

## 6. Componentes reutilizables

`src/index.css` concentra estos patrones:

| Clase | Uso |
|---|---|
| `.input-base` | Campo gris claro, borde `xl`, foco `primary`, estado disabled |
| `.label-base` | Label estándar |
| `.btn-primary` | Acción verde, texto blanco, foco y disabled |
| `.btn-secondary` | Acción alternativa `primary/10` |
| `.btn-danger` | Acción destructiva roja |
| `.card` | Superficie blanca `rounded-2xl shadow-xl border-gray-100` |
| `.form-section`, `.form-section-title` | Bloques de formulario |
| `.badge` y variantes | Etiquetas de estado |
| `.alert-success`, `.alert-error` | Feedback contextual |

Los modales usan overlay oscuro (`bg-black/40` o `bg-black/50`), tarjeta blanca `rounded-2xl shadow-xl` y cierre gris.

## 7. Formularios, reservas y estados

Inputs y selects: `gray-50`, `border-gray-300`, `rounded-xl`, texto `gray-800` y `focus:ring-primary`. Los selectores con lista desplegable deben usar un menú o listbox personalizado `rounded-xl`; el desplegable nativo del navegador no garantiza esa forma. Los errores están junto al control o en `.alert-error`; las operaciones asíncronas deshabilitan o atenúan sus botones y cambian la etiqueta a “Procesando…”, “Guardando…” o equivalente.

Paneles principales: blanco, `rounded-2xl`, `shadow-xl`. Filas y tarjetas de reservas: `rounded-xl`, bordes suaves y fondos secundarios `gray-50`. Las reservas distinguen estado y lugar con borde izquierdo de 4 px y badges. Las tablas tienen cabecera `primary` con texto blanco.

## 8. Iconografía y recursos

Los iconos de `react-icons/hi` cubren reservas, calendario, correo y navegación; `react-icons/fi` se usa en Cuentas y controles auxiliares. Los iconos de contexto suelen estar sobre `bg-primary/10` en contenedor `rounded-xl`.

- `public/logo.jpeg`: logo usado en header y autenticación.
- `public/audi.png`: fondo de Login y cambio de contraseña.
- `public/colmayor.png`: recurso heredado disponible, no referenciado por la UI actual.

## 9. Cobertura de apartados

| Apartado | Estilo aplicado |
|---|---|
| Login / cambio de contraseña | Fondo fotográfico, overlay verde, tarjetas y controles compartidos |
| Reserva del auditorio | Gradiente, Header, formulario por secciones y servicios |
| Calendario, mis reservas y eventos campus | Gradiente, Header, tarjetas, filtros y estados |
| Aprobación | Dos columnas en escritorio, tarjetas, modales y alertas |
| Dashboard | Gradiente, Header, métricas, filtros y gráficas |
| Información | Gradiente, Header y panel de contenido largo |
| Cuentas y correos | Gradiente, Header, paneles, tablas/directorios y modales |

## 10. Reglas para cambios futuros

1. Preferir tokens de Tailwind sobre hexadecimales directos.
2. Reutilizar `.input-base`, `.label-base`, `.btn-*`, `.card`, `.badge` y `.alert-*` antes de crear variantes locales.
3. Conservar el degradado en rutas autenticadas; reservar el fondo fotográfico para autenticación.
4. Usar `rounded-xl` en controles/listas y `rounded-2xl` en paneles/modales principales.
5. Mantener feedback contextual accesible con `role="alert"`, estados disabled y etiquetas de carga.
6. No añadir react-toastify, Zustand o React Hook Form solo para reproducir la guía anterior.

## 11. Checklist de coherencia

- [x] Paleta institucional configurada.
- [x] Fuente nativa configurada.
- [x] Header institucional responsive implementado.
- [x] Fondo institucional en vistas autenticadas.
- [x] Componentes base de inputs, botones, cards, badges y alertas.
- [x] Iconografía y estados de carga aplicados.
- [ ] Sustituir gradualmente hexadecimales directos heredados por los tokens institucionales.
- [ ] Unificar controles locales que repiten `.input-base` si aparecen más variantes.
