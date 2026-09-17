// SERGIO 2026-09-16: Script de datos de prueba, para poder probar el generador de certificados
// de principio a fin mientras no existen las pantallas de carga de datos.
// Uso: node scripts/seed-test-data.js
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'tecnopest.db');
const db = new Database(dbPath);

const usuario = db.prepare("SELECT id FROM usuarios WHERE rol = 'administrador' LIMIT 1").get();
if (!usuario) {
  console.error('No hay ningun usuario administrador. Crea uno primero con scripts/create-user.js');
  process.exit(1);
}

const insertarCliente = db.prepare(
  `INSERT INTO clientes (razon_social, rut, representante, rut_representante, direccion_representante, comuna_representante)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const clienteId = insertarCliente.run(
  'Jardin Infantil Sueños Encantados',
  '76.111.222-3',
  'Maria Perez',
  '12.345.678-9',
  'Doble Almeida #3789',
  'Cerrillos'
).lastInsertRowid;

const insertarDireccion = db.prepare(
  `INSERT INTO direcciones (cliente_id, nombre, direccion_linea_1, direccion_linea_2, comuna)
   VALUES (?, ?, ?, ?, ?)`
);
const direccionId = insertarDireccion.run(clienteId, 'Cerrillos', 'Doble Almeida #3789', '', 'Cerrillos').lastInsertRowid;

const insertarTipoServicio = db.prepare('INSERT INTO tipos_servicio (nombre) VALUES (?)');
const tipoDesratizacionId = insertarTipoServicio.run('Desratizacion').lastInsertRowid;
const tipoDesinsectacionId = insertarTipoServicio.run('Desinsectacion').lastInsertRowid;

const insertarProducto = db.prepare(
  `INSERT INTO productos (tipo_servicio_id, nombre, componente_principal, registro_isp, disolucion_estandar)
   VALUES (?, ?, ?, ?, ?)`
);
const rastopId = insertarProducto.run(tipoDesratizacionId, 'Rastop Bloque 10g', 'Bromadiolona', 'F-1234/06', 'Sin disolucion').lastInsertRowid;
const cyperkillId = insertarProducto.run(tipoDesinsectacionId, 'Cyperkill', 'Cipermetrina', 'P-5678/10', '80cc/10L').lastInsertRowid;

const insertarCertificado = db.prepare(
  `INSERT INTO certificados (numero, cliente_id, direccion_id, fecha_aplicacion, recomendaciones, diagnostico_previo, creado_por)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const siguienteNumero = (db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM certificados').get()).n;
const certificadoId = insertarCertificado.run(
  siguienteNumero,
  clienteId,
  direccionId,
  'Agosto 2026',
  'Mantener orden y aseo, eliminar fuentes de agua estancada.',
  '',
  usuario.id
).lastInsertRowid;

const insertarRegistro = db.prepare(
  `INSERT INTO registros_visita (cliente_id, direccion_id, tecnico_id, horario_ingreso, horario_salida, observaciones, estado, certificado_id)
   VALUES (?, ?, ?, ?, ?, ?, 'certificado', ?)`
);
const registro1Id = insertarRegistro.run(
  clienteId, direccionId, usuario.id,
  '2026-08-05 09:30:00', '2026-08-05 10:15:00',
  'Se repuso cebo en 2 cebaderas.',
  certificadoId
).lastInsertRowid;
const registro2Id = insertarRegistro.run(
  clienteId, direccionId, usuario.id,
  '2026-08-20 09:00:00', '2026-08-20 09:40:00',
  '',
  certificadoId
).lastInsertRowid;

const insertarLineaProducto = db.prepare(
  'INSERT INTO registro_productos (registro_id, producto_id, cantidad_real, zona_aplicacion) VALUES (?, ?, ?, ?)'
);
insertarLineaProducto.run(registro1Id, rastopId, '100g', 'Exterior');
insertarLineaProducto.run(registro2Id, cyperkillId, '100cc', 'Interior');

console.log(`Datos de prueba creados. certificado_id = ${certificadoId}`);
db.close();
