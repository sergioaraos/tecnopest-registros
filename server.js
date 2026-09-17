const express = require('express');
const session = require('express-session');
const path = require('path');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');
const { abrirBaseDeDatos } = require('./db');

// SERGIO 2026-09-17: la base de datos se abre con db.js, que crea la carpeta data/ y aplica el
// esquema si hace falta. Esto permite que el servidor arranque solo en un despliegue nuevo
// (por ejemplo en Cloudways), sin depender de correr "npm run migrate" a mano.
const db = abrirBaseDeDatos();

const SqliteStore = require('better-sqlite3-session-store')(session);
const authRoutes = require('./routes/auth')(db);
const certificadosRoutes = require('./routes/certificados')(db);
const adminRoutes = require('./routes/admin')(db);
const tecnicoRoutes = require('./routes/tecnico')(db);
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// SERGIO 2026-09-17: motor de plantillas para las pantallas de administracion (HTML simple, sin frameworks de frontend)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SERGIO 2026-09-17: archivos estaticos del formulario del tecnico (service worker, scripts de
// IndexedDB y firma), servidos directamente sin pasar por el motor de plantillas.
app.use(express.static(path.join(__dirname, 'public')));

// SERGIO 2026-09-16: sesion guardada en SQLite para que sobreviva un reinicio del servidor,
// con duracion larga (30 dias) ya que los tecnicos la usan desde el telefono en terreno.
app.use(session({
  store: new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 15 * 60 * 1000 // 15 minutos
    }
  }),
  secret: process.env.SESSION_SECRET || 'cambiar-este-secreto-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
  }
}));

app.use('/auth', authRoutes);
app.use('/certificados', certificadosRoutes);
app.use('/admin', adminRoutes);
app.use('/tecnico', tecnicoRoutes);

// SERGIO 2026-09-17: rutas de login/logout para navegador (formulario HTML), separadas de la
// API JSON en /auth, para poder usar las pantallas de administracion.
// SERGIO 2026-09-17: el destino tras iniciar sesion depende del rol: el administrador va al
// panel de catalogos, el tecnico va a su propio historial de registros.
function destinoSegunRol(rol) {
  return rol === 'administrador' ? '/admin' : '/tecnico';
}

app.get('/login', (req, res) => {
  if (req.session && req.session.usuarioId) {
    return res.redirect(destinoSegunRol(req.session.rol));
  }
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.render('login', { error: 'Email y contrasena son obligatorios' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);

  if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
    return res.render('login', { error: 'Email o contrasena incorrectos' });
  }

  req.session.usuarioId = usuario.id;
  req.session.nombre = usuario.nombre;
  req.session.rol = usuario.rol;

  res.redirect(destinoSegunRol(usuario.rol));
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/', (req, res) => {
  res.send('Hola desde Node.js en Cloudways. PoC funcionando, ' + new Date().toISOString());
});

// SERGIO 2026-09-16: ruta de prueba para verificar que la sesion y el login funcionan,
// antes de construir las pantallas reales.
app.get('/perfil', requireAuth, (req, res) => {
  res.json({
    usuarioId: req.session.usuarioId,
    nombre: req.session.nombre,
    rol: req.session.rol
  });
});

app.get('/test-pdf', (req, res) => {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="prueba.pdf"'
    });
    doc.pipe(res);

    doc.fontSize(20).text('Prueba de PDF con pdfkit', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Generado en Cloudways el ' + new Date().toISOString());
    doc.moveDown();

    doc.fontSize(14).text('Prueba de tabla simple:');
    doc.moveDown(0.5);

    const startY = doc.y;
    const colWidths = [150, 150, 150];
    const rows = [
      ['Producto', 'Disolución', 'Cantidad'],
      ['Cyperkill', '80cc/10L', '100cc'],
      ['Dryquat', '50cc/10L', '30cc']
    ];

    let y = startY;
    rows.forEach((row, rowIndex) => {
      let x = 50;
      row.forEach((cell, colIndex) => {
        doc.rect(x, y, colWidths[colIndex], 20).stroke();
        doc.fontSize(10).text(cell, x + 5, y + 5, { width: colWidths[colIndex] - 10 });
        x += colWidths[colIndex];
      });
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando el PDF: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
