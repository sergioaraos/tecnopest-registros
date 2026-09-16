// SERGIO 2026-09-16: Script de linea de comandos para crear un usuario nuevo o restablecer
// su contrasena si el email ya existe. Uso:
//   node scripts/create-user.js "Nombre Apellido" email@dominio.cl contrasena administrador
//   (el rol debe ser "tecnico" o "administrador")
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const [, , nombre, email, password, rol] = process.argv;

if (!nombre || !email || !password || !rol) {
  console.error('Uso: node scripts/create-user.js "Nombre" email@dominio.cl contrasena tecnico|administrador');
  process.exit(1);
}

if (rol !== 'tecnico' && rol !== 'administrador') {
  console.error('El rol debe ser "tecnico" o "administrador"');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', 'data', 'tecnopest.db');
const db = new Database(dbPath);

// SERGIO 2026-09-16: hasheamos la contrasena antes de guardarla, nunca en texto plano
const passwordHash = bcrypt.hashSync(password, 10);

const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);

if (existente) {
  // SERGIO 2026-09-16: si el email ya existe, esto sirve como restablecimiento manual de contrasena
  db.prepare("UPDATE usuarios SET nombre = ?, password_hash = ?, rol = ?, updated_at = datetime('now') WHERE email = ?")
    .run(nombre, passwordHash, rol, email);
  console.log(`Usuario actualizado: ${email} (rol: ${rol})`);
} else {
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)')
    .run(nombre, email, passwordHash, rol);
  console.log(`Usuario creado: ${email} (rol: ${rol})`);
}

db.close();
