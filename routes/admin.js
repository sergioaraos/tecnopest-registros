// SERGIO 2026-09-17: pantallas de administracion (solo rol administrador) para cargar los
// catalogos que el tecnico usara en el formulario de Registro de Visita: clientes,
// direcciones, tipos de servicio, productos y operadores.
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  router.use(requireAuth, requireRole('administrador'));

  router.get('/', (req, res) => {
    res.render('admin/index', { titulo: 'Inicio' });
  });

  // --- Clientes ---
  // SERGIO 2026-09-17: el mensaje de error de /clientes/:id/eliminar llega por query string
  // porque el redirect despues de un POST no puede pasar datos de otra forma sin sesion flash.
  router.get('/clientes', (req, res) => {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY razon_social').all();
    res.render('admin/clientes/list', { clientes, error: req.query.error || null });
  });

  router.get('/clientes/nuevo', (req, res) => {
    res.render('admin/clientes/form', { cliente: {}, error: null });
  });

  router.post('/clientes', (req, res) => {
    const { razon_social, rut, representante, rut_representante, direccion_representante, comuna_representante } = req.body;
    if (!razon_social || !rut) {
      return res.render('admin/clientes/form', { cliente: req.body, error: 'Razon social y RUT son obligatorios' });
    }
    try {
      db.prepare(
        `INSERT INTO clientes (razon_social, rut, representante, rut_representante, direccion_representante, comuna_representante)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(razon_social, rut, representante || null, rut_representante || null, direccion_representante || null, comuna_representante || null);
      res.redirect('/admin/clientes');
    } catch (err) {
      res.render('admin/clientes/form', { cliente: req.body, error: 'No se pudo guardar: ' + err.message });
    }
  });

  // SERGIO 2026-09-17: un cliente solo se puede eliminar si no tiene registros de visita ni
  // certificados asociados. Si tiene direcciones pero ningun registro/certificado, las
  // direcciones se eliminan junto con el cliente.
  router.post('/clientes/:id/eliminar', (req, res) => {
    const id = req.params.id;
    const tieneRegistros = db.prepare('SELECT COUNT(*) AS total FROM registros_visita WHERE cliente_id = ?').get(id).total > 0;
    const tieneCertificados = db.prepare('SELECT COUNT(*) AS total FROM certificados WHERE cliente_id = ?').get(id).total > 0;

    if (tieneRegistros || tieneCertificados) {
      return res.redirect('/admin/clientes?error=' + encodeURIComponent('No se puede eliminar: el cliente tiene registros de visita o certificados asociados'));
    }

    const eliminarClienteConDirecciones = db.transaction((clienteId) => {
      db.prepare('DELETE FROM direcciones WHERE cliente_id = ?').run(clienteId);
      db.prepare('DELETE FROM clientes WHERE id = ?').run(clienteId);
    });
    eliminarClienteConDirecciones(id);

    res.redirect('/admin/clientes');
  });

  router.get('/clientes/:id/editar', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).send('Cliente no encontrado');
    res.render('admin/clientes/form', { cliente, error: null });
  });

  router.post('/clientes/:id', (req, res) => {
    const { razon_social, rut, representante, rut_representante, direccion_representante, comuna_representante } = req.body;
    if (!razon_social || !rut) {
      return res.render('admin/clientes/form', { cliente: Object.assign({ id: req.params.id }, req.body), error: 'Razon social y RUT son obligatorios' });
    }
    db.prepare(
      `UPDATE clientes SET razon_social = ?, rut = ?, representante = ?, rut_representante = ?,
       direccion_representante = ?, comuna_representante = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(razon_social, rut, representante || null, rut_representante || null, direccion_representante || null, comuna_representante || null, req.params.id);
    res.redirect('/admin/clientes');
  });

  // --- Direcciones (anidadas bajo un cliente) ---
  router.get('/clientes/:clienteId/direcciones', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.clienteId);
    if (!cliente) return res.status(404).send('Cliente no encontrado');
    const direcciones = db.prepare('SELECT * FROM direcciones WHERE cliente_id = ? ORDER BY nombre').all(req.params.clienteId);
    res.render('admin/direcciones/list', { cliente, direcciones });
  });

  router.get('/clientes/:clienteId/direcciones/nueva', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.clienteId);
    if (!cliente) return res.status(404).send('Cliente no encontrado');
    res.render('admin/direcciones/form', { cliente, direccion: {}, error: null });
  });

  router.post('/clientes/:clienteId/direcciones', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.clienteId);
    if (!cliente) return res.status(404).send('Cliente no encontrado');
    const { nombre, direccion_linea_1, direccion_linea_2, comuna } = req.body;
    if (!direccion_linea_1) {
      return res.render('admin/direcciones/form', { cliente, direccion: req.body, error: 'La direccion (linea 1) es obligatoria' });
    }
    db.prepare(
      'INSERT INTO direcciones (cliente_id, nombre, direccion_linea_1, direccion_linea_2, comuna) VALUES (?, ?, ?, ?, ?)'
    ).run(cliente.id, nombre || null, direccion_linea_1, direccion_linea_2 || null, comuna || null);
    res.redirect('/admin/clientes/' + cliente.id + '/direcciones');
  });

  router.get('/clientes/:clienteId/direcciones/:id/editar', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.clienteId);
    if (!cliente) return res.status(404).send('Cliente no encontrado');
    const direccion = db.prepare('SELECT * FROM direcciones WHERE id = ? AND cliente_id = ?').get(req.params.id, cliente.id);
    if (!direccion) return res.status(404).send('Direccion no encontrada');
    res.render('admin/direcciones/form', { cliente, direccion, error: null });
  });

  router.post('/clientes/:clienteId/direcciones/:id', (req, res) => {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.clienteId);
    if (!cliente) return res.status(404).send('Cliente no encontrado');
    const { nombre, direccion_linea_1, direccion_linea_2, comuna } = req.body;
    if (!direccion_linea_1) {
      return res.render('admin/direcciones/form', {
        cliente,
        direccion: Object.assign({ id: req.params.id }, req.body),
        error: 'La direccion (linea 1) es obligatoria'
      });
    }
    db.prepare(
      `UPDATE direcciones SET nombre = ?, direccion_linea_1 = ?, direccion_linea_2 = ?, comuna = ?,
       updated_at = datetime('now') WHERE id = ? AND cliente_id = ?`
    ).run(nombre || null, direccion_linea_1, direccion_linea_2 || null, comuna || null, req.params.id, cliente.id);
    res.redirect('/admin/clientes/' + cliente.id + '/direcciones');
  });

  // --- Tipos de servicio ---
  router.get('/tipos-servicio', (req, res) => {
    const tiposServicio = db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all();
    res.render('admin/tipos-servicio/list', { tiposServicio, error: null });
  });

  router.post('/tipos-servicio', (req, res) => {
    const { nombre } = req.body;
    const tiposServicio = db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all();
    if (!nombre) {
      return res.render('admin/tipos-servicio/list', { tiposServicio, error: 'El nombre es obligatorio' });
    }
    try {
      db.prepare('INSERT INTO tipos_servicio (nombre) VALUES (?)').run(nombre);
      res.redirect('/admin/tipos-servicio');
    } catch (err) {
      res.render('admin/tipos-servicio/list', { tiposServicio, error: 'No se pudo guardar: ' + err.message });
    }
  });

  // --- Productos ---
  router.get('/productos', (req, res) => {
    const productos = db.prepare(
      `SELECT p.*, ts.nombre AS tipo_servicio_nombre FROM productos p
       JOIN tipos_servicio ts ON ts.id = p.tipo_servicio_id ORDER BY p.nombre`
    ).all();
    res.render('admin/productos/list', { productos });
  });

  router.get('/productos/nuevo', (req, res) => {
    const tiposServicio = db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all();
    res.render('admin/productos/form', { producto: {}, tiposServicio, error: null });
  });

  router.post('/productos', (req, res) => {
    const { nombre, tipo_servicio_id, componente_principal, registro_isp, disolucion_estandar } = req.body;
    const tiposServicio = db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all();
    if (!nombre || !tipo_servicio_id) {
      return res.render('admin/productos/form', { producto: req.body, tiposServicio, error: 'Nombre y tipo de servicio son obligatorios' });
    }
    db.prepare(
      `INSERT INTO productos (tipo_servicio_id, nombre, componente_principal, registro_isp, disolucion_estandar)
       VALUES (?, ?, ?, ?, ?)`
    ).run(tipo_servicio_id, nombre, componente_principal || null, registro_isp || null, disolucion_estandar || null);
    res.redirect('/admin/productos');
  });

  router.get('/productos/:id/editar', (req, res) => {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) return res.status(404).send('Producto no encontrado');
    const tiposServicio = db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all();
    res.render('admin/productos/form', { producto, tiposServicio, error: null });
  });

  router.post('/productos/:id', (req, res) => {
    const { nombre, tipo_servicio_id, componente_principal, registro_isp, disolucion_estandar } = req.body;
    const tiposServicio = db.prepare('SELECT * FROM tipos_servicio ORDER BY nombre').all();
    if (!nombre || !tipo_servicio_id) {
      return res.render('admin/productos/form', {
        producto: Object.assign({ id: req.params.id }, req.body),
        tiposServicio,
        error: 'Nombre y tipo de servicio son obligatorios'
      });
    }
    db.prepare(
      `UPDATE productos SET nombre = ?, tipo_servicio_id = ?, componente_principal = ?, registro_isp = ?, disolucion_estandar = ?
       WHERE id = ?`
    ).run(nombre, tipo_servicio_id, componente_principal || null, registro_isp || null, disolucion_estandar || null, req.params.id);
    res.redirect('/admin/productos');
  });

  router.post('/productos/:id/toggle-activo', (req, res) => {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!producto) return res.status(404).send('Producto no encontrado');
    db.prepare('UPDATE productos SET activo = ? WHERE id = ?').run(producto.activo ? 0 : 1, req.params.id);
    res.redirect('/admin/productos');
  });

  // --- Operadores ---
  router.get('/operadores', (req, res) => {
    const operadores = db.prepare('SELECT * FROM operadores ORDER BY nombre').all();
    res.render('admin/operadores/list', { operadores });
  });

  router.get('/operadores/nuevo', (req, res) => {
    res.render('admin/operadores/form', { operador: {}, error: null });
  });

  router.post('/operadores', (req, res) => {
    const { nombre } = req.body;
    if (!nombre) {
      return res.render('admin/operadores/form', { operador: req.body, error: 'El nombre es obligatorio' });
    }
    db.prepare('INSERT INTO operadores (nombre) VALUES (?)').run(nombre);
    res.redirect('/admin/operadores');
  });

  router.get('/operadores/:id/editar', (req, res) => {
    const operador = db.prepare('SELECT * FROM operadores WHERE id = ?').get(req.params.id);
    if (!operador) return res.status(404).send('Operador no encontrado');
    res.render('admin/operadores/form', { operador, error: null });
  });

  router.post('/operadores/:id', (req, res) => {
    const { nombre } = req.body;
    if (!nombre) {
      return res.render('admin/operadores/form', { operador: Object.assign({ id: req.params.id }, req.body), error: 'El nombre es obligatorio' });
    }
    db.prepare('UPDATE operadores SET nombre = ? WHERE id = ?').run(nombre, req.params.id);
    res.redirect('/admin/operadores');
  });

  router.post('/operadores/:id/toggle-activo', (req, res) => {
    const operador = db.prepare('SELECT * FROM operadores WHERE id = ?').get(req.params.id);
    if (!operador) return res.status(404).send('Operador no encontrado');
    db.prepare('UPDATE operadores SET activo = ? WHERE id = ?').run(operador.activo ? 0 : 1, req.params.id);
    res.redirect('/admin/operadores');
  });

  return router;
};
