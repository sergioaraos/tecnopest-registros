// SERGIO 2026-09-16: logica para armar los datos de un certificado a partir de sus registros
// de visita y generar el .docx final con docxtemplater, sin guardar copia en el servidor.
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'certificado.docx');
const MIN_FILAS_PRODUCTOS = 3;

// SERGIO 2026-09-16: numero de certificado con ceros a la izquierda, largo fijo de 7 digitos
function formatearNumero(numero, largo = 7) {
  return String(numero).padStart(largo, '0');
}

// SERGIO 2026-09-16: horario_ingreso se guarda como "YYYY-MM-DD HH:MM:SS", extraemos solo la fecha
function soloFecha(horario) {
  return horario.split(' ')[0].split('T')[0];
}

function formatearFechaCorta(horario) {
  const [anio, mes, dia] = soloFecha(horario).split('-');
  return `${dia}-${mes}-${anio}`;
}

// SERGIO 2026-09-16: arma "5, 12 y 20" a partir de una lista de numeros de dia
function formatearListaDias(dias) {
  if (dias.length === 0) return '';
  if (dias.length === 1) return String(dias[0]);
  return dias.slice(0, -1).join(', ') + ' y ' + dias[dias.length - 1];
}

function completarMinimo(productos, minimo) {
  const out = productos.slice();
  while (out.length < minimo) {
    out.push({ servicio: '', producto: '', componente: '', ISP: '', dosis: '', zona: '', fecha_aplicacion: '' });
  }
  return out;
}

// SERGIO 2026-09-16: arma todos los datos de un certificado (cliente, direccion, dias de
// servicio, tabla de productos y observaciones) a partir de la base de datos.
function armarDatosCertificado(db, certificadoId) {
  const certificado = db.prepare('SELECT * FROM certificados WHERE id = ?').get(certificadoId);
  if (!certificado) {
    throw new Error('Certificado no encontrado');
  }

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(certificado.cliente_id);
  const direccion = db.prepare('SELECT * FROM direcciones WHERE id = ?').get(certificado.direccion_id);

  const registros = db
    .prepare('SELECT * FROM registros_visita WHERE certificado_id = ? ORDER BY horario_ingreso')
    .all(certificadoId);

  const diasSet = new Set(registros.map((r) => parseInt(soloFecha(r.horario_ingreso).split('-')[2], 10)));
  const dias = Array.from(diasSet).sort((a, b) => a - b);

  const lineasProducto = db
    .prepare(
      `SELECT rp.cantidad_real, rp.zona_aplicacion, p.nombre AS producto, p.componente_principal,
              p.registro_isp, ts.nombre AS tipo_servicio
       FROM registro_productos rp
       JOIN productos p ON p.id = rp.producto_id
       JOIN tipos_servicio ts ON ts.id = p.tipo_servicio_id
       JOIN registros_visita rv ON rv.id = rp.registro_id
       WHERE rv.certificado_id = ?
       ORDER BY rv.horario_ingreso`
    )
    .all(certificadoId);

  const productos = completarMinimo(
    lineasProducto.map((l) => ({
      servicio: l.tipo_servicio,
      producto: l.producto,
      componente: l.componente_principal || '',
      ISP: l.registro_isp || '',
      fecha_aplicacion: certificado.fecha_aplicacion,
      dosis: l.cantidad_real || '',
      zona: l.zona_aplicacion || ''
    })),
    MIN_FILAS_PRODUCTOS
  );

  const observaciones = registros
    .filter((r) => r.observaciones && r.observaciones.trim() !== '')
    .map((r) => ({
      fecha_obs: formatearFechaCorta(r.horario_ingreso),
      nombre_direccion: direccion.nombre || '',
      observacion: r.observaciones
    }));

  return {
    num_certificado: formatearNumero(certificado.numero),
    fecha_aplicacion: certificado.fecha_aplicacion,
    razón_social: cliente.razon_social,
    rut_cliente: cliente.rut,
    direccion_1_cliente: direccion.direccion_linea_1,
    direccion_2_cliente: direccion.direccion_linea_2 || '',
    comuna_cliente: direccion.comuna || '',
    representante_cliente: cliente.representante || '',
    rut_representante: cliente.rut_representante || '',
    direccion_representante: cliente.direccion_representante || '',
    comuna_representante: cliente.comuna_representante || '',
    uno_o_mas_dias: dias.length > 1 ? 'los días' : 'el día',
    dias_servicio: formatearListaDias(dias),
    productos,
    observaciones,
    recomendaciones: certificado.recomendaciones || '',
    diagnostico_previo: certificado.diagnostico_previo || ''
  };
}

// SERGIO 2026-09-16: genera el .docx final en memoria (buffer), no guarda copia en el servidor
function generarCertificadoDocx(db, certificadoId) {
  const datos = armarDatosCertificado(db, certificadoId);

  const content = fs.readFileSync(TEMPLATE_PATH, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }
  });

  doc.render(datos);

  return doc.getZip().generate({ type: 'nodebuffer' });
}

module.exports = { generarCertificadoDocx, armarDatosCertificado };
