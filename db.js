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

  // SERGIO 2026-09-18: la app verifica a mano la integridad referencial en cada ruta (por
  // ejemplo, antes de eliminar un cliente), nunca dependimos de que SQLite la exigiera. Se
  // apaga foreign_keys explicitamente porque en el build de better-sqlite3 que usa Sergio
  // localmente viene activada por defecto, y eso rompe la migracion de usuarios de mas abajo
  // (ver comentario ahi).
  db.pragma('foreign_keys = OFF');

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

  // SERGIO 2026-09-18: agregar el rol "administrativo". SQLite no permite modificar un
  // CHECK con ALTER TABLE, asi que si la tabla usuarios todavia tiene el CHECK viejo (sin
  // administrativo), se reconstruye conservando todos los datos existentes.
  // Ademas de apagar foreign_keys arriba, se activa legacy_alter_table mientras se hace el
  // RENAME: sin esto, SQLite reescribe solo la definicion de las tablas que apuntan a
  // usuarios (registros_visita, certificados) para que digan "usuarios_viejo" en vez de
  // "usuarios", y esa referencia queda mal (apuntando a una tabla que ya no existe) despues
  // de terminar la migracion. Con legacy_alter_table = ON esas tablas se quedan tal como
  // estaban escritas ("usuarios"), que es lo correcto porque el nombre se vuelve a usar de
  // inmediato para la tabla nueva. Todo el bloque va en una transaccion explicita para que,
  // si algo falla a mitad de camino, no quede la base de datos con las dos tablas a la vez.
  const creacionUsuarios = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get();
  if (creacionUsuarios && !creacionUsuarios.sql.includes('administrativo')) {
    db.exec(`
      PRAGMA legacy_alter_table = ON;
      BEGIN;
      ALTER TABLE usuarios RENAME TO usuarios_viejo;
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('tecnico', 'administrador', 'administrativo')),
        activo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO usuarios SELECT * FROM usuarios_viejo;
      DROP TABLE usuarios_viejo;
      COMMIT;
      PRAGMA legacy_alter_table = OFF;
    `);
    console.log('Tabla usuarios reconstruida: se agrego el rol administrativo');
  }

  return db;
}

module.exports = { abrirBaseDeDatos, DB_PATH };
