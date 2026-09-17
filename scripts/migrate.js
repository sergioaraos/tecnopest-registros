// SERGIO 2026-09-16: Script de migracion inicial. Crea el archivo SQLite (si no existe)
// y ejecuta el esquema completo de migrations/schema.sql.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'tecnopest.db');
const schemaPath = path.join(__dirname, '..', 'migrations', 'schema.sql');

// SERGIO 2026-09-16: nos aseguramos de que exista la carpeta data/ antes de crear el archivo .db
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
const schema = fs.readFileSync(schemaPath, 'utf8');

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

console.log('Migracion aplicada correctamente en ' + dbPath);
db.close();
