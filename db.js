// SERGIO 2026-09-17: apertura de la base de datos SQLite, compartida entre server.js y
// scripts/migrate.js. Crea la carpeta data/ y aplica el esquema si hace falta, para que el
// servidor pueda arrancar solo (sin depender de un paso manual) en un despliegue nuevo como
// Cloudways, donde no hay forma de ejecutar un comando aparte despues del despliegue.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'tecnopest.db');
const SCHEMA_PATH = path.join(__dirname, 'migrations', 'schema.sql');

function abrirBaseDeDatos() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  // SERGIO 2026-09-16: ajuste para bases de datos creadas antes de agregar direccion_id a
  // certificados (un certificado corresponde siempre a una sola direccion del cliente).
  // CREATE TABLE IF NOT EXISTS no altera tablas ya existentes, asi que lo agregamos a mano
  // si hace falta, para no perder los datos ya cargados.
  const columnas = db.prepare("PRAGMA table_info(certificados)").all();
  const tieneDireccionId = columnas.some((c) => c.name === 'direccion_id');
  if (!tieneDireccionId) {
    db.exec('ALTER TABLE certificados ADD COLUMN direccion_id INTEGER REFERENCES direcciones(id)');
    console.log('Columna direccion_id agregada a certificados');
  }

  // SERGIO 2026-09-17: ajuste para bases de datos creadas antes de agregar las marcas
  // automaticas de apertura/guardado del formulario de registro de visita.
  const columnasRegistros = db.prepare("PRAGMA table_info(registros_visita)").all();
  const nombresRegistros = columnasRegistros.map((c) => c.name);
  if (!nombresRegistros.includes('hora_apertura_formulario')) {
    db.exec("ALTER TABLE registros_visita ADD COLUMN hora_apertura_formulario TEXT NOT NULL DEFAULT ''");
    console.log('Columna hora_apertura_formulario agregada a registros_visita');
  }
  if (!nombresRegistros.includes('hora_guardado_formulario')) {
    db.exec("ALTER TABLE registros_visita ADD COLUMN hora_guardado_formulario TEXT NOT NULL DEFAULT ''");
    console.log('Columna hora_guardado_formulario agregada a registros_visita');
  }

  return db;
}

module.exports = { abrirBaseDeDatos, DB_PATH };
