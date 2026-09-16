const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const PDFDocument = require('pdfkit');

// SERGIO 2026-09-16: conexion a la base de datos SQLite, usada por la sesion y las rutas de login
const db = new Database(path.join(__dirname, 'data', 'tecnopest.db'));

const SqliteStore = require('better-sqlite3-session-store')(session);
const authRoutes = require('./routes/auth')(db);
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
