// SERGIO 2026-09-17: pantallas de administracion (solo rol administrador) para cargar los
// catalogos que el tecnico usara en el formulario de Registro de Visita: clientes,
// direcciones, tipos de servicio, productos y operadores.
const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, requireRole } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // SERGIO 2026-09-18: el panel de administracion queda abierto a administrador y
  // administrativo por igual (clientes, direcciones, productos, registros). Tipos de
  // servicio, operadores y usuarios quedan restringidos solo a administrador, con el
  // guardia soloAdministrador aplicado por prefijo de ruta.
  router.use(requireAuth, requireRole(['administrador', 'administrativo']));

  const soloAdministrador = requireRole('administrador');
  router.use('/tipos-servicio', soloAdministrador);
  router.use('/operadores', soloAdministrador);
  router.use('/usuarios', soloAdministrador);

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

  // --- Registros de visita ---
  // SERGIO 2026-09-18: el admin puede ver y editar los registros de visita que cargan los
  // tecnicos. Un registro que ya quedo asociado a un certificado emitido no se puede editar,
  // para que el certificado siga siendo consistente con lo que se genero.
  router.get('/registros', (req, res) => {
    const clienteId = req.query.cliente_id || '';
    let sql = `SELECT rv.id, rv.horario_ingreso, rv.horario_salida, rv.estado,
                      c.razon_social AS cliente, d.direccion_linea_1 AS direccion, d.comuna,
                      u.nombre AS tecnico
               FROM registros_visita rv
               JOIN clientes c ON c.id = rv.cliente_id
               JOIN direcciones d ON d.id = rv.direccion_id
               JOIN usuarios u ON u.id = rv.tecnico_id`;
    const params = [];
    if (clienteId) {
      sql += ' WHERE rv.cliente_id = ?';
      params.push(clienteId);
    }
    sql += ' ORDER BY rv.horario_ingreso DESC';
    const registros = db.prepare(sql).all(...params);
    const clientes = db.prepare('SELECT id, razon_social FROM clientes ORDER BY razon_social').all();
    res.render('admin/registros/list', { registros, clientes, clienteId, error: req.query.error || null });
  });

  // SERGIO 2026-09-18: el tecnico asignado (quien cargo el registro con su cuenta de la
  // app) ya no se puede cambiar desde este formulario, a pedido de Sergio: se presta a
  // confusion con "Operadores" (los aplicadores en terreno), que es un concepto distinto.
  // El tecnico_id del registro queda fijo, tal como se guardo originalmente.
  function cargarCatalogosRegistro(db) {
    const clientes = db.prepare('SELECT id, razon_social FROM clientes ORDER BY razon_social').all();
    const direcciones = db.prepare(
      `SELECT d.id, d.cliente_id, d.direccion_linea_1, d.comuna, c.razon_social
       FROM direcciones d JOIN clientes c ON c.id = d.cliente_id ORDER BY c.razon_social, d.direccion_linea_1`
    ).all();
    const operadores = db.prepare('SELECT id, nombre FROM operadores WHERE activo = 1 ORDER BY nombre').all();
    const productos = db.prepare('SELECT id, nombre FROM productos WHERE activo = 1 ORDER BY nombre').all();
    return { clientes, direcciones, operadores, productos };
  }

  router.get('/registros/:id/editar', (req, res) => {
    const registro = db.prepare('SELECT * FROM registros_visita WHERE id = ?').get(req.params.id);
    if (!registro) return res.status(404).send('Registro no encontrado');
    if (registro.estado === 'certificado') {
      return res.redirect('/admin/registros?error=' + encodeURIComponent('Este registro ya tiene un certificado emitido y no se puede editar'));
    }

    const catalogos = cargarCatalogosRegistro(db);
    const operadorIdsSeleccionados = db.prepare('SELECT operador_id FROM registro_operadores WHERE registro_id = ?')
      .all(req.params.id).map((r) => r.operador_id);
    const productosSeleccionados = db.prepare('SELECT producto_id, cantidad_real, zona_aplicacion FROM registro_productos WHERE registro_id = ?')
      .all(req.params.id);

    res.render('admin/registros/form', Object.assign({
      registro, operadorIdsSeleccionados, productosSeleccionados, error: null
    }, catalogos));
  });

  router.post('/registros/:id', (req, res) => {
    const registro = db.prepare('SELECT * FROM registros_visita WHERE id = ?').get(req.params.id);
    if (!registro) return res.status(404).send('Registro no encontrado');
    if (registro.estado === 'certificado') {
      return res.redirect('/admin/registros?error=' + encodeURIComponent('Este registro ya tiene un certificado emitido y no se puede editar'));
    }

    const { cliente_id, direccion_id, horario_ingreso, horario_salida, observaciones } = req.body;
    const operadorIds = [].concat(req.body.operador_ids || []).filter(Boolean);
    const productoIds = [].concat(req.body.producto_id || []).filter(Boolean);
    const cantidadesReales = [].concat(req.body.cantidad_real || []);
    const zonasAplicacion = [].concat(req.body.zona_aplicacion || []);

    function volverConError(mensaje) {
      const catalogos = cargarCatalogosRegistro(db);
      return res.render('admin/registros/form', Object.assign({
        registro: Object.assign({ id: req.params.id }, req.body),
        operadorIdsSeleccionados: operadorIds,
        productosSeleccionados: productoIds.map((id, i) => ({
          producto_id: id, cantidad_real: cantidadesReales[i], zona_aplicacion: zonasAplicacion[i]
        })),
        error: mensaje
      }, catalogos));
    }

    if (!cliente_id || !direccion_id || !horario_ingreso || !horario_salida) {
      return volverConError('Faltan datos obligatorios');
    }
    const direccion = db.prepare('SELECT * FROM direcciones WHERE id = ?').get(direccion_id);
    if (!direccion || String(direccion.cliente_id) !== String(cliente_id)) {
      return volverConError('La direccion elegida no pertenece al cliente elegido');
    }
    if (operadorIds.length === 0) {
      return volverConError('Debe indicar al menos un operador');
    }
    if (productoIds.length === 0) {
      return volverConError('Debe indicar al menos un producto');
    }

    const actualizarRegistro = db.transaction(() => {
      // SERGIO 2026-09-18: no se toca tecnico_id, queda igual a como se guardo originalmente.
      db.prepare(
        `UPDATE registros_visita SET cliente_id = ?, direccion_id = ?,
         horario_ingreso = ?, horario_salida = ?, observaciones = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(cliente_id, direccion_id, horario_ingreso, horario_salida, observaciones || null, req.params.id);

      db.prepare('DELETE FROM registro_operadores WHERE registro_id = ?').run(req.params.id);
      const insertarOperador = db.prepare('INSERT INTO registro_operadores (registro_id, operador_id) VALUES (?, ?)');
      operadorIds.forEach((operadorId) => insertarOperador.run(req.params.id, operadorId));

      db.prepare('DELETE FROM registro_productos WHERE registro_id = ?').run(req.params.id);
      const insertarProducto = db.prepare(
        'INSERT INTO registro_productos (registro_id, producto_id, cantidad_real, zona_aplicacion) VALUES (?, ?, ?, ?)'
      );
      productoIds.forEach((productoId, i) => {
        insertarProducto.run(req.params.id, productoId, cantidadesReales[i] || null, zonasAplicacion[i] || null);
      });
    });
    actualizarRegistro();

    res.redirect('/admin/registros');
  });

  // --- Usuarios (tecnicos y administrativos) ---
  // SERGIO 2026-09-18: pantalla para que el administrador cree y mantenga cuentas de tecnico
  // y administrativo. La cuenta de administrador sigue sin poder crearse ni editarse desde
  // aca (se maneja por variable de entorno en Cloudways), para no arriesgar quedarse sin
  // acceso si algo sale mal en esta pantalla.
  router.get('/usuarios', (req, res) => {
    const usuarios = db.prepare(
      "SELECT * FROM usuarios WHERE rol IN ('tecnico', 'administrativo') ORDER BY nombre"
    ).all();
    res.render('admin/usuarios/list', { usuarios, error: req.query.error || null });
  });

  router.get('/usuarios/nuevo', (req, res) => {
    res.render('admin/usuarios/form', { usuario: {}, error: null });
  });

  router.post('/usuarios', (req, res) => {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) {
      return res.render('admin/usuarios/form', { usuario: req.body, error: 'Todos los campos son obligatorios' });
    }
    if (rol !== 'tecnico' && rol !== 'administrativo') {
      return res.render('admin/usuarios/form', { usuario: req.body, error: 'Rol invalido' });
    }
    try {
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(
        'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)'
      ).run(nombre, email, passwordHash, rol);
      res.redirect('/admin/usuarios');
    } catch (err) {
      res.render('admin/usuarios/form', { usuario: req.body, error: 'No se pudo guardar: ' + err.message });
    }
  });

  router.get('/usuarios/:id/editar', (req, res) => {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario || usuario.rol === 'administrador') return res.status(404).send('Usuario no encontrado');
    res.render('admin/usuarios/form', { usuario, error: null });
  });

  router.post('/usuarios/:id', (req, res) => {
    const usuarioActual = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuarioActual || usuarioActual.rol === 'administrador') return res.status(404).send('Usuario no encontrado');

    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !rol) {
      return res.render('admin/usuarios/form', {
        usuario: Object.assign({ id: req.params.id }, req.body),
        error: 'Nombre, email y rol son obligatorios'
      });
    }
    if (rol !== 'tecnico' && rol !== 'administrativo') {
      return res.render('admin/usuarios/form', {
        usuario: Object.assign({ id: req.params.id }, req.body),
        error: 'Rol invalido'
      });
    }
    try {
      if (password) {
        const passwordHash = bcrypt.hashSync(password, 10);
        db.prepare(
          `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(nombre, email, rol, passwordHash, req.params.id);
      } else {
        db.prepare(
          `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(nombre, email, rol, req.params.id);
      }
      res.redirect('/admin/usuarios');
    } catch (err) {
      res.render('admin/usuarios/form', {
        usuario: Object.assign({ id: req.params.id }, req.body),
        error: 'No se pudo guardar: ' + err.message
      });
    }
  });

  router.post('/usuarios/:id/toggle-activo', (req, res) => {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario || usuario.rol === 'administrador') return res.status(404).send('Usuario no encontrado');
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(usuario.activo ? 0 : 1, req.params.id);
    res.redirect('/admin/usuarios');
  });

  return router;
};
