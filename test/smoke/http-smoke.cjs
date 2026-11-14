// Prueba de humo de la capa HTTP (guards, rutas, pipes) con Prisma simulado en memoria.
// Se ejecuta con `npm run test:smoke`, que antes compila el backend a ./dist-smoke.
const path = require('path');
const BACK = process.argv[2] || process.cwd();
const req = (m) => require(require.resolve(m, { paths: [BACK] }));

const { Test } = req('@nestjs/testing');
const request = req('supertest');
const { JwtService } = req('@nestjs/jwt');

process.env.GOOGLE_CLIENT_ID = 'x';
process.env.GOOGLE_CLIENT_SECRET = 'x';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/cb';

const { AppModule } = require(path.join(BACK, 'dist-smoke/app.module'));
const { PrismaService } = require(path.join(BACK, 'dist-smoke/prisma/prisma.service'));
const { CloudinaryService } = require(path.join(BACK, 'dist-smoke/cloudinary/cloudinary.service'));

// ---- Prisma en memoria (solo lo que usan los flujos probados) ----
const db = { items: [], logs: [], users: [], seq: { item: 0, log: 0 } };
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return true;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not;
    if (v && typeof v === 'object') return true;
    return row[k] === v;
  });
const withUser = (i) => ({ ...i, user: pick(db.users.find((u) => u.id === i.userId) ?? {}, ['name', 'email']) });

const prisma = {
  item: {
    create: async ({ data }) => { const r = { id: ++db.seq.item, state: 'ACTIVE', resolvedAt: null, createdAt: new Date(), ...data }; db.items.push(r); return r; },
    findUnique: async ({ where, include }) => { const i = db.items.find((x) => x.id === where.id); return i ? (include?.user ? withUser(i) : i) : null; },
    findMany: async ({ where, include }) => db.items.filter((i) => matches(i, where)).map((i) => (include?.user ? withUser(i) : i)),
    count: async ({ where }) => db.items.filter((i) => matches(i, where)).length,
    update: async ({ where, data }) => Object.assign(db.items.find((i) => i.id === where.id), data),
    delete: async ({ where }) => { const i = db.items.findIndex((x) => x.id === where.id); return db.items.splice(i, 1)[0]; },
  },
  auditLog: {
    create: async ({ data }) => { const r = { id: ++db.seq.log, createdAt: new Date(), ...data }; db.logs.push(r); return r; },
    findMany: async () => [...db.logs].reverse().map((l) => ({ ...l, actor: null })),
    count: async () => db.logs.length,
  },
  user: {},
  $transaction: async (cb) => cb(prisma),
};

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`);
  if (!cond) failures++;
};

(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(prisma)
    .overrideProvider(CloudinaryService).useValue({ uploadImage: async () => ({ secure_url: 'https://img/x.jpg' }) })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  const http = request(app.getHttpServer());
  const jwt = moduleRef.get(JwtService);

  db.users.push(
    { id: 1, name: 'Dueño Uno', email: 'dueno@udea.edu.co' },
    { id: 2, name: 'Interesado Dos', email: 'interesado@udea.edu.co' },
    { id: 3, name: 'Admin Tres', email: 'admin@udea.edu.co' },
  );
  const tok = (id, role = 'STUDENT') => `Bearer ${jwt.sign({ sub: id, email: `u${id}@udea.edu.co`, role })}`;
  const owner = tok(1), other = tok(2), admin = tok(3, 'ADMIN');

  const publish = (auth, status, title, extra = {}) => {
    let r = http.post('/items').set('Authorization', auth)
      .field('title', title).field('description', `${title} descripción`)
      .field('category', 'tecnologia').field('city', 'Medellín, Colombia').field('location', 'Biblioteca')
      .field('status', status);
    for (const [k, v] of Object.entries(extra)) r = r.field(k, v);
    return r;
  };

  // --- Publicar un objeto encontrado con detalle privado
  let r = await publish(owner, 'found', 'Celular negro', { privateDetail: 'Pantalla rota en la esquina' });
  check('POST /items crea el reporte', r.status === 201 && r.body.id === 1, JSON.stringify(r.body));

  // --- El detalle privado y el correo no son públicos
  r = await http.get('/items');
  check('GET /items oculta privateDetail y no expone correos', r.status === 200 && r.body.items.length === 1 && !('privateDetail' in r.body.items[0]) && r.body.items[0].hasPrivateDetail === true && !JSON.stringify(r.body).includes('@udea.edu.co'), JSON.stringify(r.body));
  r = await http.get('/items/1');
  check('GET /items/:id oculta privateDetail', r.status === 200 && !('privateDetail' in r.body), JSON.stringify(r.body));
  r = await http.get('/items/me').set('Authorization', owner);
  check('GET /items/me conserva el detalle para el autor', r.status === 200 && r.body[0].privateDetail === 'Pantalla rota en la esquina', JSON.stringify(r.body));

  // --- Contactar
  r = await http.get('/items/1/contact');
  check('GET /items/:id/contact sin token -> 401', r.status === 401, String(r.status));
  r = await http.get('/items/abc/contact').set('Authorization', other);
  check('id no numérico -> 400 (ParseIntPipe)', r.status === 400, String(r.status));
  r = await http.get('/items/1/contact').set('Authorization', owner);
  check('el autor no puede contactarse a sí mismo -> 400', r.status === 400, JSON.stringify(r.body));
  r = await http.get('/items/999/contact').set('Authorization', other);
  check('reporte inexistente -> 404', r.status === 404, String(r.status));
  r = await http.get('/items/1/contact').set('Authorization', other);
  check('usuario autenticado obtiene el correo del publicador', r.status === 200 && r.body.email === 'dueno@udea.edu.co' && r.body.hasPrivateDetail === true && !('privateDetail' in r.body), JSON.stringify(r.body));

  // --- Resolver (entregado / encontrado)
  r = await http.patch('/items/1/state').set('Authorization', other).send({ state: 'RESOLVED' });
  check('un tercero no puede marcar el reporte como resuelto -> 403', r.status === 403, String(r.status));
  r = await http.patch('/items/1/state').send({ state: 'RESOLVED' });
  check('PATCH /items/:id/state sin token -> 401', r.status === 401, String(r.status));
  r = await http.patch('/items/1/state').set('Authorization', owner).send({ state: 'OTRO' });
  check('estado inválido -> 400', r.status === 400, String(r.status));
  r = await http.patch('/items/1/state').set('Authorization', owner).send({ state: 'RESOLVED', note: 'Se lo entregué en portería' });
  check('el publicador marca el objeto como entregado -> 200', r.status === 200 && r.body.state === 'RESOLVED' && r.body.resolvedAt, JSON.stringify(r.body));
  r = await http.get('/items');
  check('el objeto resuelto sale del listado público', r.status === 200 && r.body.total === 0, JSON.stringify(r.body));
  r = await http.get('/items/me').set('Authorization', owner);
  check('pero sigue en "mis objetos" del publicador', r.status === 200 && r.body.length === 1 && r.body[0].state === 'RESOLVED', JSON.stringify(r.body));
  r = await http.get('/items/1/contact').set('Authorization', other);
  check('ya no se entrega contacto de un objeto resuelto -> 400', r.status === 400, String(r.status));
  r = await http.patch('/items/1/state').set('Authorization', owner).send({ state: 'ACTIVE' });
  check('el publicador puede reabrirlo -> 200', r.status === 200 && r.body.state === 'ACTIVE' && r.body.resolvedAt === null, JSON.stringify(r.body));

  // --- Un objeto perdido también lo resuelve quien lo publicó
  r = await publish(other, 'lost', 'Termo azul');
  check('publicar un objeto perdido -> 201', r.status === 201 && r.body.id === 2, JSON.stringify(r.body));
  r = await http.patch('/items/2/state').set('Authorization', other).send({ state: 'RESOLVED' });
  check('quien publicó un objeto perdido lo marca como encontrado -> 200', r.status === 200 && r.body.state === 'RESOLVED', JSON.stringify(r.body));

  // --- Panel de administración
  r = await http.get('/admin/audit');
  check('GET /admin/audit sin token -> 401', r.status === 401, String(r.status));
  r = await http.get('/admin/audit').set('Authorization', owner);
  check('GET /admin/audit como estudiante -> 403', r.status === 403, String(r.status));
  r = await http.get('/admin/claims').set('Authorization', admin);
  check('ya no existe la ruta de reclamaciones -> 404', r.status === 404, String(r.status));
  r = await http.get('/admin/items').set('Authorization', admin);
  check('GET /admin/items como admin lista activos y resueltos', r.status === 200 && r.body.total === 2, JSON.stringify(r.body));
  r = await http.get('/admin/items?state=RESOLVED').set('Authorization', admin);
  check('filtra por estado RESOLVED', r.status === 200 && r.body.total === 1 && r.body.items[0].id === 2, JSON.stringify(r.body));
  r = await http.patch('/admin/items/2/state').set('Authorization', admin).send({ state: 'ACTIVE', note: 'Marcado por error' });
  check('admin reabre un reporte ajeno -> 200', r.status === 200 && r.body.state === 'ACTIVE', JSON.stringify(r.body));
  r = await http.patch('/admin/items/2/state').set('Authorization', other).send({ state: 'RESOLVED' });
  check('PATCH /admin/items/:id/state como estudiante -> 403', r.status === 403, String(r.status));

  // --- Auditoría
  r = await http.get('/admin/audit').set('Authorization', admin);
  const actions = r.body.logs.map((l) => l.action).reverse();
  const expected = ['ITEM_CREATED', 'CONTACT_REQUESTED', 'ITEM_RESOLVED', 'ITEM_REOPENED', 'ITEM_CREATED', 'ITEM_RESOLVED', 'ITEM_STATE_CHANGED'];
  check('la bitácora registra todo el flujo en orden', r.status === 200 && JSON.stringify(actions) === JSON.stringify(expected), JSON.stringify(actions));

  // --- Moderación
  r = await http.delete('/admin/items/1').set('Authorization', owner);
  check('DELETE /admin/items/:id como estudiante -> 403', r.status === 403, String(r.status));
  r = await http.delete('/admin/items/1').set('Authorization', admin);
  check('admin elimina un reporte -> 200', r.status === 200 && db.items.length === 1, JSON.stringify(r.body));

  await app.close();
  console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLO(S)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
