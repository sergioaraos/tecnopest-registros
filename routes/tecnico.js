// SERGIO 2026-09-17: rutas del rol tecnico. El formulario de Registro de Visita funciona sin
// conexion (los catalogos y los registros pendientes se guardan en el telefono con IndexedDB,
// ver public/js/tecnico-db.js), y estas rutas exponen los catalogos, reciben la sincronizacion
// de los registros pendientes y listan los registros ya sincronizados de cada tecnico.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');

const CARPETA_FIRMAS = path.join(__dirname, '..', 'uploads', 'firmas');

function guardarFirma(dataUrl, nombreArchivo) {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('Firma invalida');
  }
  fs.mkdirSync(CARPETA_FIRMAS, { recursive: true });
  const rutaCompleta = path.join(CARPETA_FIRMAS, nombreArchivo);
  fs.writeFileSync(rutaCompleta, Buffer.from(match[1], 'base64'));
  return path.join('uploads', 'firmas', nombreArchivo);
}

module.exports = function (db) {
  const router = express.Router();

  router.use(requireAuth, requireRole('tecnico'));

  // SERGIO 2026-09-17: pantalla de inicio del tecnico, historial de registros (sincronizados y pendientes)
  router.get('/', (req, res) => {
    res.render('tecnico/historial', { titulo: 'Mis registros' });
  });

  // SERGIO 2026-09-17: formulario de Registro de Visita, debe poder cargar sin conexion
  router.get('/nuevo', (req, res) => {
    res.render('tecnico/nuevo', { titulo: 'Nuevo registro de visita' });
  });

  // SERGIO 2026-09-17: catalogos que el telefono descarga y guarda localmente para poder
  // llenar el formulario sin conexion
  router.get('/catalogos', (req, res) => {
    const clientes = db.prepare('SELECT id, razon_social, rut FROM clientes ORDER BY razon_social').all();
    const direcciones = db.prepare('SELECT id, cliente_id, nombre, direccion_linea_1, direccion_linea_2, comuna FROM direcciones ORDER BY direccion_linea_1').all();
    const tiposServicio = db.prepare('SELECT id, nombre FROM tipos_servicio ORDER BY nombre').all();
    const productos = db.prepare('SELECT id, tipo_servicio_id, nombre, componente_principal, registro_isp, disolucion_estandar FROM productos WHERE activo = 1 ORDER BY nombre').all();
    const operadores = db.prepare('SELECT id, nombre FROM operadores WHERE activo = 1 ORDER BY nombre').all();

    res.json({ clientes, direcciones, tiposServicio, productos, operadores });
  });

  // SERGIO 2026-09-17: registros ya sincronizados de este tecnico, para mostrar en el historial
  router.get('/registros', (req, res) => {
    const registros = db.prepare(
      `SELECT rv.id, rv.horario_ingreso, rv.estado, c.razon_social AS cliente,
              d.direccion_linea_1 AS direccion, d.comuna
       FROM registros_visita rv
       JOIN clientes c ON c.id = rv.cliente_id
       JOIN direcciones d ON d.id = rv.direccion_id
       WHERE rv.tecnico_id = ?
       ORDER BY rv.created_at DESC
       LIMIT 100`
    ).all(req.session.usuarioId);

    res.json({ registros });
  });

  // SERGIO 2026-09-17: recibe los registros guardados localmente en el telefono (uno o varios)
  // y los inserta en la base de datos. Cada registro se procesa en su propia transaccion, para
  // que si uno falla los demas se guarden igual.
  router.post('/registros/sync', (req, res) => {
    const registros = (req.body && req.body.registros) || [];
    const resultados = [];

    const insertarRegistro = db.transaction((r) => {
      const info = db.prepare(
        `INSERT INTO registros_visita
           (cliente_id, direccion_id, tecnico_id, horario_ingreso, horario_salida,
            hora_apertura_formulario, hora_guardado_formulario, observaciones, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`
      ).run(
        r.clienteId,
        r.direccionId,
        req.session.usuarioId,
        r.horarioIngreso,
        r.horarioSalida,
        r.horaAperturaFormulario,
        r.horaGuardadoFormulario,
        r.observaciones || null
      );

      const registroId = info.lastInsertRowid;

      const rutaFirmaTecnico = guardarFirma(r.firmaTecnico, `registro-${registroId}-tecnico.png`);
      const rutaFirmaCliente = guardarFirma(r.firmaCliente, `registro-${registroId}-cliente.png`);

      db.prepare('UPDATE registros_visita SET firma_tecnico_path = ?, firma_cliente_path = ? WHERE id = ?')
        .run(rutaFirmaTecnico, rutaFirmaCliente, registroId);

      const insertarOperador = db.prepare('INSERT INTO registro_operadores (registro_id, operador_id) VALUES (?, ?)');
      (r.operadorIds || []).forEach((operadorId) => insertarOperador.run(registroId, operadorId));

      const insertarProducto = db.prepare(
        'INSERT INTO registro_productos (registro_id, producto_id, cantidad_real, zona_aplicacion) VALUES (?, ?, ?, ?)'
      );
      (r.productos || []).forEach((p) => insertarProducto.run(registroId, p.productoId, p.cantidadReal || null, p.zonaAplicacion || null));

      return registroId;
    });

    for (const r of registros) {
      try {
        if (!r.clienteId || !r.direccionId || !r.horarioIngreso || !r.horarioSalida) {
          throw new Error('Faltan datos obligatorios del registro');
        }
        if (!r.operadorIds || r.operadorIds.length === 0) {
          throw new Error('Debe indicar al menos un operador');
        }
        if (!r.productos || r.productos.length === 0) {
          throw new Error('Debe indicar al menos un producto');
        }
        const registroId = insertarRegistro(r);
        resultados.push({ idLocal: r.idLocal, ok: true, id: registroId });
      } catch (err) {
        resultados.push({ idLocal: r.idLocal, ok: false, error: err.message });
      }
    }

    res.json({ resultados });
  });

  return router;
};
