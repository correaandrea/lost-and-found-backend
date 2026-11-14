// Datos de demostración: usuarios ficticios (nombre.apellido@udea.edu.co) y reportes a su nombre.
// Sirven para probar "Contactar", los filtros, las coincidencias y el panel de administración.
//
//   npm run seed:demo          inserta los datos (se puede repetir sin duplicar)
//   npm run seed:demo:clean    elimina los usuarios ficticios y todos sus reportes
//
// Las cuentas son inventadas: no se puede iniciar sesión con ellas y su único propósito es
// ser "la otra persona" a la que se contacta. Nunca se tocan los reportes ni usuarios reales.
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const DEMO_USERS = [
  ['Laura Restrepo', 'laura.restrepo'],
  ['Camilo Zapata', 'camilo.zapata'],
  ['Valentina Osorio', 'valentina.osorio'],
  ['Santiago Gaviria', 'santiago.gaviria'],
  ['Daniela Cardona', 'daniela.cardona'],
  ['Juan Henao', 'juan.henao'],
  ['Mariana Betancur', 'mariana.betancur'],
  ['Sebastián Londoño', 'sebastian.londono'],
  ['Isabela Agudelo', 'isabela.agudelo'],
  ['Andrés Mejía', 'andres.mejia'],
  ['Carolina Vargas', 'carolina.vargas'],
  ['Felipe Ruiz', 'felipe.ruiz'],
].map(([name, local]) => ({ name, email: `${local}@udea.edu.co` }));

const MED = 'Medellín, Colombia';

// [índice de usuario, estado, categoría, sede, ubicación, título, descripción, días atrás, detalle privado, resuelto]
const DEMO_ITEMS = [
  [0, 'found', 'termos', MED, 'Bloque 22, piso 1', 'Termo azul', 'Termo azul de acero con una calcomanía de Linux en la tapa', 1, 'Tiene una abolladura en la base', false],
  [1, 'lost', 'termos', MED, 'Cafetería central', 'Termo azul', 'Perdí mi termo azul de acero con calcomanías, creo que en la cafetería', 2, null, false],
  [2, 'found', 'documentos', MED, 'Portería principal', 'Carné estudiantil', 'Carné de la universidad encontrado junto a la portería', 0, 'El carné pertenece a un estudiante de ingeniería', false],
  [3, 'lost', 'documentos', MED, 'Biblioteca central', 'Cédula de ciudadanía', 'Perdí mi cédula dentro de una funda transparente', 3, null, false],
  [4, 'found', 'tecnologia', MED, 'Bloque 19, sala de cómputo', 'Cargador de portátil', 'Cargador negro de portátil con cable largo', 1, 'La punta del cable tiene cinta aislante', false],
  [5, 'lost', 'tecnologia', MED, 'Bloque 19', 'Cargador de portátil', 'Perdí el cargador negro de mi portátil en la sala de cómputo', 1, null, false],
  [6, 'found', 'tecnologia', MED, 'Biblioteca, segundo piso', 'Audífonos inalámbricos', 'Estuche blanco con audífonos inalámbricos', 4, 'El estuche tiene un rayón en la tapa', false],
  [7, 'lost', 'ropa', MED, 'Bloque 21', 'Chaqueta negra', 'Chaqueta negra impermeable talla M, la dejé en un salón', 5, null, false],
  [8, 'found', 'ropa', MED, 'Auditorio', 'Suéter gris', 'Suéter gris con capucha olvidado en el auditorio', 6, null, false],
  [9, 'lost', 'llaves', MED, 'Estadio, entrada norte', 'Llaves con llavero rojo', 'Tres llaves con un llavero rojo en forma de corazón', 2, null, false],
  [10, 'found', 'llaves', MED, 'Bloque 18, pasillo', 'Llaves con llavero rojo', 'Manojo de llaves con llavero rojo encontrado en el pasillo', 2, 'Una de las llaves es dorada y pequeña', false],
  [11, 'lost', 'estudio', MED, 'Bloque 16', 'Cuaderno de cálculo', 'Cuaderno cuadriculado de cálculo diferencial con tapa verde', 7, null, false],
  [0, 'found', 'estudio', MED, 'Biblioteca central', 'Libro de física', 'Libro de física universitaria con notas en los márgenes', 8, 'En la primera página hay un nombre escrito a lápiz', false],
  [1, 'lost', 'accesorios', MED, 'Bloque 22', 'Gafas de marco negro', 'Gafas de marco negro con estuche azul', 9, null, false],
  [2, 'found', 'accesorios', MED, 'Cafetería central', 'Sombrilla azul', 'Sombrilla plegable azul oscuro', 10, null, false],
  [3, 'lost', 'otro', MED, 'Zona deportiva', 'Balón de fútbol', 'Balón de fútbol blanco y verde con mi nombre', 12, null, false],
  [4, 'found', 'tecnologia', 'Turbo, Colombia', 'Sede Urabá, bloque principal', 'Calculadora científica', 'Calculadora científica negra encontrada en un salón', 3, 'Tiene un sticker de un gato en la parte trasera', false],
  [5, 'lost', 'tecnologia', 'Turbo, Colombia', 'Sede Urabá, laboratorio', 'Calculadora científica', 'Perdí mi calculadora científica negra en el laboratorio', 4, null, false],
  [6, 'lost', 'documentos', 'Apartadó, Colombia', 'Sede Apartadó, biblioteca', 'Tarjeta profesional', 'Tarjeta con mi foto y datos, dentro de un portacarnet', 5, null, false],
  [7, 'found', 'ropa', 'Sonsón, Colombia', 'Sede Sonsón, cancha', 'Gorra roja', 'Gorra roja de béisbol encontrada en la cancha', 6, null, false],
  [8, 'lost', 'termos', 'Caucasia, Colombia', 'Sede Caucasia, bloque 2', 'Botella deportiva verde', 'Botella deportiva verde de plástico con tapa negra', 11, null, false],
  [9, 'found', 'otro', MED, 'Portería principal', 'Paraguas negro', 'Paraguas negro grande entregado en portería', 14, null, true],
  [10, 'found', 'accesorios', MED, 'Bloque 19', 'Reloj de pulso', 'Reloj de pulso con correa de cuero marrón', 15, 'La correa tiene un hueco extra hecho a mano', true],
  [11, 'lost', 'llaves', 'Apartadó, Colombia', 'Sede Apartadó, parqueadero', 'Llave de moto', 'Llave de moto con control remoto negro', 18, null, false],
];

async function seed(pool) {
  const ids = {};
  for (const u of DEMO_USERS) {
    const { rows } = await pool.query(
      `insert into "User" (email, name, role) values ($1, $2, 'STUDENT')
       on conflict (email) do update set name = excluded.name
       returning id`,
      [u.email, u.name],
    );
    ids[u.email] = rows[0].id;
  }

  let created = 0;
  for (const [ui, status, category, city, location, title, description, daysAgo, privateDetail, resolved] of DEMO_ITEMS) {
    const userId = ids[DEMO_USERS[ui].email];
    const exists = await pool.query('select 1 from "Item" where "userId" = $1 and title = $2', [userId, title]);
    if (exists.rowCount > 0) continue;
    await pool.query(
      `insert into "Item" (title, description, category, city, location, status, state, "resolvedAt",
                           "privateDetail", "createdAt", "updatedAt", "userId")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               now() - ($10 || ' days')::interval - ($11 || ' hours')::interval, now(), $12)`,
      [title, description, category, city, location, status, resolved ? 'RESOLVED' : 'ACTIVE',
       resolved ? new Date() : null, privateDetail, String(daysAgo), String((userId * 3) % 20), userId],
    );
    created++;
  }
  console.log(`Usuarios ficticios: ${DEMO_USERS.length} · Reportes nuevos: ${created} (de ${DEMO_ITEMS.length})`);
}

async function clean(pool) {
  const emails = DEMO_USERS.map((u) => u.email);
  const { rows } = await pool.query('select id from "User" where email = any($1)', [emails]);
  const userIds = rows.map((r) => r.id);
  if (userIds.length === 0) return console.log('No hay datos de demostración que eliminar.');
  const items = await pool.query('delete from "Item" where "userId" = any($1)', [userIds]);
  await pool.query('delete from "AuditLog" where "actorId" = any($1)', [userIds]);
  const users = await pool.query('delete from "User" where id = any($1)', [userIds]);
  console.log(`Eliminados: ${users.rowCount} usuarios ficticios y ${items.rowCount} reportes.`);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await (process.argv.includes('--clean') ? clean(pool) : seed(pool));
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
