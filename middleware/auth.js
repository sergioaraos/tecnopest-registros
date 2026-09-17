// SERGIO 2026-09-16: middleware de autenticacion y autorizacion por rol, basado en la sesion
// creada por express-session (ver routes/auth.js).
// SERGIO 2026-09-17: si la peticion viene de un navegador (pide HTML), redirige a /login en
// vez de devolver un 401 en JSON, para que las pantallas de administracion sean usables.

function esNavegacionHtml(req) {
  return req.accepts(['html', 'json']) === 'html';
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    if (esNavegacionHtml(req)) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
}

function requireRole(rol) {
  return function (req, res, next) {
    if (!req.session || !req.session.usuarioId) {
      if (esNavegacionHtml(req)) {
        return res.redirect('/login');
      }
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (req.session.rol !== rol) {
      if (esNavegacionHtml(req)) {
        return res.status(403).send('No autorizado para esta accion');
      }
      return res.status(403).json({ error: 'No autorizado para esta accion' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
