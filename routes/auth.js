// SERGIO 2026-09-16: rutas de login y logout. Valida email/contrasena contra la tabla usuarios
// y guarda el usuario autenticado en la sesion.
const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function (db) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contrasena son obligatorios' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email);

    if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
      return res.status(401).json({ error: 'Email o contrasena incorrectos' });
    }

    // SERGIO 2026-09-16: guardamos solo lo necesario en la sesion, nunca el hash de la contrasena
    req.session.usuarioId = usuario.id;
    req.session.nombre = usuario.nombre;
    req.session.rol = usuario.rol;

    res.json({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  return router;
};
