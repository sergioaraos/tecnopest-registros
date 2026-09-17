// SERGIO 2026-09-17: logica del formulario de Registro de Visita. Trabaja siempre contra los
// catalogos guardados localmente (IndexedDB) y guarda el registro terminado tambien de forma
// local, como pendiente de sincronizar (ver public/js/tecnico-historial.js para la sincronizacion).
(function () {
  const horaAperturaFormulario = new Date().toISOString();

  let catalogos = null;
  let firmaTecnico = null;
  let firmaCliente = null;

  const elMensaje = document.getElementById('mensaje');
  const elBuscadorCliente = document.getElementById('buscador-cliente');
  const elResultadosCliente = document.getElementById('resultados-cliente');
  const elClienteId = document.getElementById('cliente-id');
  const elBloqueDireccion = document.getElementById('bloque-direccion');
  const elDireccionId = document.getElementById('direccion-id');
  const elListaOperadores = document.getElementById('lista-operadores');
  const elListaProductos = document.getElementById('lista-productos');
  const elPlantillaLineaProducto = document.getElementById('plantilla-linea-producto');

  function mostrarMensaje(texto, tipo) {
    elMensaje.innerHTML = '<div class="' + (tipo || 'error') + '">' + texto + '</div>';
  }

  function limpiarMensaje() {
    elMensaje.innerHTML = '';
  }

  function nombreDireccion(direccion) {
    const partes = [direccion.direccion_linea_1];
    if (direccion.direccion_linea_2) partes.push(direccion.direccion_linea_2);
    if (direccion.comuna) partes.push(direccion.comuna);
    return (direccion.nombre ? direccion.nombre + ' - ' : '') + partes.join(', ');
  }

  function renderizarOperadores() {
    elListaOperadores.innerHTML = catalogos.operadores.map((op) =>
      '<label><input type="checkbox" class="check-operador" value="' + op.id + '"> ' + op.nombre + '</label>'
    ).join('');
  }

  function opcionesProducto() {
    return catalogos.tiposServicio.map((tipo) => {
      const productosDelTipo = catalogos.productos.filter((p) => p.tipo_servicio_id === tipo.id);
      if (productosDelTipo.length === 0) return '';
      const opciones = productosDelTipo.map((p) => '<option value="' + p.id + '">' + p.nombre + '</option>').join('');
      return '<optgroup label="' + tipo.nombre + '">' + opciones + '</optgroup>';
    }).join('');
  }

  function agregarLineaProducto() {
    const nodo = elPlantillaLineaProducto.content.cloneNode(true);
    const select = nodo.querySelector('.select-producto');
    select.innerHTML = '<option value="">Selecciona un producto</option>' + opcionesProducto();
    nodo.querySelector('.btn-quitar-producto').addEventListener('click', function (evento) {
      evento.target.closest('.linea-producto').remove();
    });
    elListaProductos.appendChild(nodo);
  }

  function buscarClientes(texto) {
    if (!texto) {
      elResultadosCliente.innerHTML = '';
      return;
    }
    const textoNormalizado = texto.toLowerCase();
    const coincidencias = catalogos.clientes
      .filter((c) => c.razon_social.toLowerCase().includes(textoNormalizado))
      .slice(0, 8);

    elResultadosCliente.innerHTML = coincidencias.map((c) =>
      '<div class="resultado-cliente" data-id="' + c.id + '" data-nombre="' + c.razon_social.replace(/"/g, '&quot;') + '" style="padding:8px;background:#fff;border:1px solid #ddd;border-top:none;cursor:pointer;">' + c.razon_social + '</div>'
    ).join('');
  }

  function seleccionarCliente(id, nombre) {
    elClienteId.value = id;
    elBuscadorCliente.value = nombre;
    elResultadosCliente.innerHTML = '';

    const direcciones = catalogos.direcciones.filter((d) => d.cliente_id === Number(id));
    elDireccionId.innerHTML = direcciones.map((d) => '<option value="' + d.id + '">' + nombreDireccion(d) + '</option>').join('');
    elBloqueDireccion.style.display = direcciones.length ? 'block' : 'none';
  }

  function generarIdLocal() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function recolectarProductos() {
    return Array.from(elListaProductos.querySelectorAll('.linea-producto')).map((linea) => ({
      productoId: Number(linea.querySelector('.select-producto').value) || null,
      cantidadReal: linea.querySelector('.input-cantidad').value.trim(),
      zonaAplicacion: linea.querySelector('.input-zona').value.trim()
    }));
  }

  function guardarRegistro() {
    limpiarMensaje();

    const clienteId = Number(elClienteId.value) || null;
    const direccionId = Number(elDireccionId.value) || null;
    const operadorIds = Array.from(elListaOperadores.querySelectorAll('.check-operador:checked')).map((c) => Number(c.value));
    const productos = recolectarProductos();
    const horarioIngreso = document.getElementById('horario-ingreso').value;
    const horarioSalida = document.getElementById('horario-salida').value;
    const observaciones = document.getElementById('observaciones').value.trim();

    if (!clienteId) return mostrarMensaje('Selecciona un cliente.');
    if (!direccionId) return mostrarMensaje('Selecciona una direccion.');
    if (operadorIds.length === 0) return mostrarMensaje('Selecciona al menos un operador.');
    if (productos.length === 0) return mostrarMensaje('Agrega al menos un producto.');
    if (productos.some((p) => !p.productoId)) return mostrarMensaje('Hay una linea de producto sin producto seleccionado.');
    if (!horarioIngreso || !horarioSalida) return mostrarMensaje('Completa el horario de ingreso y de salida.');
    if (!firmaTecnico || firmaTecnico.estaVacio()) return mostrarMensaje('Falta la firma del tecnico.');
    if (!firmaCliente || firmaCliente.estaVacio()) return mostrarMensaje('Falta la firma del cliente.');

    const registro = {
      idLocal: generarIdLocal(),
      clienteId,
      direccionId,
      operadorIds,
      productos,
      horarioIngreso,
      horarioSalida,
      horaAperturaFormulario,
      horaGuardadoFormulario: new Date().toISOString(),
      observaciones,
      firmaTecnico: firmaTecnico.obtenerDataUrl(),
      firmaCliente: firmaCliente.obtenerDataUrl()
    };

    window.TecnicoDB.guardarRegistroPendiente(registro).then(function () {
      mostrarMensaje('Registro guardado en el telefono. Quedara pendiente de sincronizar. Puedes revisarlo en <a href="/tecnico">Mis registros</a>.', 'aviso');
      reiniciarFormulario();
    }).catch(function (err) {
      mostrarMensaje('No se pudo guardar el registro: ' + err.message);
    });
  }

  function reiniciarFormulario() {
    elClienteId.value = '';
    elBuscadorCliente.value = '';
    elResultadosCliente.innerHTML = '';
    elBloqueDireccion.style.display = 'none';
    elDireccionId.innerHTML = '';
    elListaOperadores.querySelectorAll('.check-operador').forEach((c) => { c.checked = false; });
    elListaProductos.innerHTML = '';
    document.getElementById('horario-ingreso').value = '';
    document.getElementById('horario-salida').value = '';
    document.getElementById('observaciones').value = '';
    firmaTecnico.limpiar();
    firmaCliente.limpiar();
  }

  window.TecnicoDB.obtenerCatalogos().then(function (datos) {
    if (!datos) {
      mostrarMensaje('No hay catalogos descargados en este telefono. Conectate una vez a internet y vuelve a intentar.');
      return;
    }
    catalogos = datos;
    renderizarOperadores();
    agregarLineaProducto();

    elBuscadorCliente.addEventListener('input', function () {
      buscarClientes(this.value.trim());
    });

    elResultadosCliente.addEventListener('click', function (evento) {
      const item = evento.target.closest('.resultado-cliente');
      if (!item) return;
      seleccionarCliente(item.dataset.id, item.dataset.nombre);
    });

    document.getElementById('btn-agregar-producto').addEventListener('click', agregarLineaProducto);
    document.getElementById('btn-guardar').addEventListener('click', guardarRegistro);

    firmaTecnico = window.TecnicoFirma.inicializar(document.getElementById('firma-tecnico'));
    firmaCliente = window.TecnicoFirma.inicializar(document.getElementById('firma-cliente'));

    document.getElementById('btn-limpiar-firma-tecnico').addEventListener('click', () => firmaTecnico.limpiar());
    document.getElementById('btn-limpiar-firma-cliente').addEventListener('click', () => firmaCliente.limpiar());
  });
})();
