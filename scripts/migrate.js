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

console.log('Migracion aplicada correctamente en ' + dbPath);
db.close();
