# Lost & Found Uni — Backend

API REST de **Lost & Found Uni**, un sistema centralizado para reportar, buscar y recuperar objetos perdidos y encontrados en la Universidad de Antioquia (UdeA).

> Proyecto desarrollado por **Emanuel Munera Pérez** y **Andrea Correa Arango** para el curso *Proyecto Integrador II* (Ingeniería de Sistemas, Universidad de Antioquia).

El frontend vive en el repositorio hermano [`lost-and-found-frontend`](../lost-and-found-frontend).

## Qué hace

- **Autenticación institucional:** inicio de sesión con Google OAuth 2.0 restringido a cuentas `@udea.edu.co`; la sesión se maneja con JWT.
- **Reportes de objetos:** publicar objetos perdidos o encontrados con foto (Cloudinary), categoría, sede, ubicación y un *detalle privado de verificación* opcional para objetos encontrados.
- **Búsqueda:** filtros combinables por texto, sede, ubicación, categoría, estado y rango de fechas, con paginación en el servidor.
- **Coincidencias:** sugiere reportes del estado opuesto (perdido ↔ encontrado) de la misma sede y categoría, ordenados por similitud textual.
- **Contacto:** entrega el correo de quien publicó un reporte, solo a usuarios autenticados, para escribirle por Gmail.
- **Resolución:** quien publica un reporte lo marca como resuelto (entregado o encontrado) o lo reabre.
- **Administración y auditoría:** rol `ADMIN` para moderar reportes, y una bitácora de los cambios de estado y de las consultas de contacto.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | [NestJS](https://nestjs.com) 12 · TypeScript |
| Base de datos | PostgreSQL (desarrollado sobre [Neon](https://neon.tech)) con [Prisma](https://www.prisma.io) 7 |
| Imágenes | [Cloudinary](https://cloudinary.com) |
| Autenticación | Passport (Google OAuth 2.0) · JWT |
| Pruebas | Jest · Supertest |
| Calidad | Oxlint · Prettier |

## Requisitos previos

- Node.js 22 o superior
- Una base de datos PostgreSQL (por ejemplo, un proyecto gratuito en Neon)
- Una cuenta de Cloudinary
- Credenciales OAuth de Google Cloud (tipo *aplicación web*)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (ver tabla abajo)
cp .env.example .env

# 3. Generar el cliente de Prisma y crear las tablas
npx prisma generate --config prisma7.config.ts
npx prisma db push --config prisma7.config.ts

# 4. Levantar el servidor en modo desarrollo (http://localhost:3000)
npm run start:dev
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credenciales de Cloudinary |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Credenciales OAuth de Google |
| `GOOGLE_CALLBACK_URL` | URL de retorno registrada en Google, p. ej. `http://localhost:3000/auth/google/callback` |
| `JWT_SECRET` | Secreto para firmar los tokens. Usa un valor largo y aleatorio |
| `ADMIN_EMAILS` | Correos con rol administrador, separados por coma. El rol se asigna en el siguiente inicio de sesión |

El archivo `.env` no se versiona. Nunca subas credenciales al repositorio.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Servidor en modo *watch* |
| `npm run build` / `npm run start:prod` | Compila y ejecuta la versión de producción |
| `npm test` | Pruebas unitarias |
| `npm run test:cov` | Pruebas con cobertura |
| `npm run test:smoke` | Prueba de humo de la capa HTTP (compila a `dist-smoke` y lo borra al terminar) |
| `npm run lint` | Análisis estático con Oxlint |
| `npm run seed:demo` | Inserta usuarios y reportes ficticios para probar |
| `npm run seed:demo:clean` | Elimina esos datos de demostración |

## API

Las rutas marcadas con 🔒 exigen el encabezado `Authorization: Bearer <token>`.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/auth/google` | Inicia el flujo con Google |
| GET | `/auth/google/callback` | Retorno de Google; redirige al frontend con el token |

### Objetos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/items` | Listado público de reportes activos (filtros abajo) |
| GET | `/items/:id` | Detalle de un reporte |
| GET | `/items/:id/matches` | Posibles coincidencias del reporte |
| POST 🔒 | `/items` | Publica un reporte (`multipart/form-data`: `title`, `description`, `category`, `city`, `location`, `status`, `image`?, `privateDetail`?) |
| GET 🔒 | `/items/me` | Reportes del usuario, incluidos los resueltos |
| GET 🔒 | `/items/:id/contact` | Correo de quien publicó el reporte (queda en la auditoría) |
| PATCH 🔒 | `/items/:id/state` | El autor cambia el estado: `{ "state": "ACTIVE" \| "RESOLVED", "note"? }` |
| DELETE 🔒 | `/items/:id` | El autor elimina su reporte |

**Filtros de `GET /items`:** `search`, `location`, `category`, `city`, `status` (`lost`/`found`), `from`, `to` (`AAAA-MM-DD`), `page`, `limit` (máx. 100). `category`, `city` y `status` aceptan varios valores separados por `|`.

### Administración (rol `ADMIN`) 🔒

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/items` | Todos los reportes (activos y resueltos), con búsqueda y filtro por estado |
| PATCH | `/admin/items/:id/state` | Cambia el estado de cualquier reporte |
| DELETE | `/admin/items/:id` | Elimina cualquier reporte |
| GET | `/admin/audit` | Bitácora de auditoría paginada |

## Modelo de datos

- **User:** correo único, nombre, foto y rol (`STUDENT` | `ADMIN`).
- **Item:** título, descripción, categoría, sede, ubicación, imagen, tipo (`lost`/`found`), estado de gestión (`ACTIVE` | `RESOLVED`), fecha de resolución y detalle privado. Pertenece a un usuario, y su correo es el contacto del reporte.
- **AuditLog:** usuario, acción, reporte y detalles de cada acción auditada. No tiene llave foránea al reporte para conservar el historial si este se elimina.

> La tabla `Claim` del esquema es un resto de un diseño anterior (flujo de reclamación y aprobación). Está vacía y el código no la usa; se puede eliminar quitando el modelo y ejecutando `prisma db push --accept-data-loss`.

## Pruebas

```bash
npm test            # 91 pruebas unitarias
npm run test:smoke  # 29 comprobaciones sobre las rutas, guards y permisos
```

- Las pruebas unitarias aíslan la lógica de negocio con dobles de la base de datos, de Cloudinary y de JWT. NestJS 12 se publica solo como ESM, por lo que Jest lo reemplaza por un doble mínimo (`test/nest-mocks.ts`).
- La prueba de humo arranca la aplicación completa con una base de datos simulada en memoria (`test/smoke/http-smoke.cjs`). No consulta PostgreSQL real.
- `test/app.e2e-spec.ts` es la plantilla de NestJS y no se mantiene.

## Estructura

```
src/
├── auth/         Google OAuth, JWT, roles y guard de administrador
├── items/        Reportes: filtros, coincidencias, contacto y estado
├── admin/        Moderación de reportes y consulta de la auditoría
├── audit/        Bitácora de auditoría
├── cloudinary/   Subida de imágenes
├── prisma/       Acceso a la base de datos
└── common/       Utilidades compartidas (paginación)
prisma/schema.prisma   Modelo de datos
scripts/demo-data.cjs  Datos de demostración
test/                  Doble de NestJS y prueba de humo
```

## Limitaciones conocidas

- El destino de la redirección tras el login (`http://localhost:5173`) y el puerto (3000) están fijos en el código; falta parametrizarlos para un despliegue.
- CORS está abierto y `JWT_SECRET` tiene un valor por defecto en el código si falta la variable: ambos deben endurecerse antes de producción.
- El proyecto no está desplegado; se ejecuta en local.

## Créditos

Proyecto académico de **Emanuel Munera Pérez** y **Andrea Correa Arango**, Universidad de Antioquia — Proyecto Integrador II. Sin licencia de uso abierto (`UNLICENSED`).
