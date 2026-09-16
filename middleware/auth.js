// SERGIO 2026-09-16: middleware de autenticacion y autorizacion por rol, basado en la sesion
// creada por express-session (ver routes/auth.js).

function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

function requireRole(rol) {
  return function (req, res, next) {
    if (!req.session || !req.session.usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (req.session.rol !== rol) {
      return res.status(403).json({ error: 'No autorizado para esta accion' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
