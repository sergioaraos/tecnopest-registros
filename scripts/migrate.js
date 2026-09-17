// SERGIO 2026-09-17: script de migracion para uso manual (por ejemplo en tu computador). Usa el
// mismo modulo db.js que usa server.js al arrancar, para que ambos apliquen exactamente el mismo
// esquema y los mismos ajustes.
const { abrirBaseDeDatos, DB_PATH } = require('../db');

const db = abrirBaseDeDatos();

console.log('Migracion aplicada correctamente en ' + DB_PATH);
db.close();
