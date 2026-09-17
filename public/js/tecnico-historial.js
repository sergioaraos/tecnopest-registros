// SERGIO 2026-09-17: pantalla de historial del tecnico. Combina los registros ya sincronizados
// (traidos del servidor) con los que quedaron pendientes guardados localmente en el telefono, y
// permite sincronizar los pendientes con un boton.
(function () {
  const elMensaje = document.getElementById('mensaje');
  const elCuerpoTabla = document.getElementById('cuerpo-tabla-registros');
  const elBtnSincronizar = document.getElementById('btn-sincronizar');

  function mostrarMensaje(texto, tipo) {
    elMensaje.innerHTML = '<div class="' + (tipo || 'error') + '">' + texto + '</div>';
  }

  function limpiarMensaje() {
    elMensaje.innerHTML = '';
  }

  function nombreDireccionCatalogo(catalogos, direccionId) {
    const direccion = (catalogos.direcciones || []).find((d) => d.id === direccionId);
    if (!direccion) return '';
    return direccion.direccion_linea_1 + (direccion.comuna ? ', ' + direccion.comuna : '');
  }

  function nombreClienteCatalogo(catalogos, clienteId) {
    const cliente = (catalogos.clientes || []).find((c) => c.id === clienteId);
    return cliente ? cliente.razon_social : '';
  }

  function obtenerSincronizados() {
    if (!navigator.onLine) return Promise.resolve([]);
    return fetch('/tecnico/registros')
      .then((resp) => (resp.ok ? resp.json() : { registros: [] }))
      .then((datos) => (datos.registros || []).map((r) => ({
        fecha: r.horario_ingreso,
        cliente: r.cliente,
        direccion: r.direccion + (r.comuna ? ', ' + r.comuna : ''),
        sincronizado: true
      })))
      .catch(() => []);
  }

  function obtenerPendientes() {
    return Promise.all([
      window.TecnicoDB.listarRegistrosPendientes(),
      window.TecnicoDB.obtenerCatalogos()
    ]).then(([pendientes, catalogos]) => pendientes.map((r) => ({
      fecha: r.horarioIngreso,
      cliente: catalogos ? nombreClienteCatalogo(catalogos, r.clienteId) : '',
      direccion: catalogos ? nombreDireccionCatalogo(catalogos, r.direccionId) : '',
      sincronizado: false
    })));
  }

  function renderizarLista() {
    elCuerpoTabla.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

    Promise.all([obtenerSincronizados(), obtenerPendientes()]).then(([sincronizados, pendientes]) => {
      const todos = sincronizados.concat(pendientes).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

      if (todos.length === 0) {
        elCuerpoTabla.innerHTML = '<tr><td colspan="4">Todavia no hay registros.</td></tr>';
        return;
      }

      elCuerpoTabla.innerHTML = todos.map((r) =>
        '<tr><td>' + (r.fecha || '') + '</td><td>' + r.cliente + '</td><td>' + r.direccion + '</td>' +
        '<td class="' + (r.sincronizado ? 'estado-sincronizado' : 'estado-pendiente') + '">' +
        (r.sincronizado ? 'Sincronizado' : 'Pendiente de sincronizar') + '</td></tr>'
      ).join('');
    });
  }

  function sincronizar() {
    limpiarMensaje();

    window.TecnicoDB.listarRegistrosPendientes().then(function (pendientes) {
      if (pendientes.length === 0) {
        mostrarMensaje('No hay registros pendientes de sincronizar.', 'aviso');
        return;
      }

      fetch('/tecnico/registros/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registros: pendientes })
      })
        .then((resp) => resp.json())
        .then((datos) => {
          const resultados = datos.resultados || [];
          const errores = resultados.filter((r) => !r.ok);
          const exitosos = resultados.filter((r) => r.ok);

          Promise.all(exitosos.map((r) => window.TecnicoDB.eliminarRegistroPendiente(r.idLocal))).then(function () {
            if (errores.length === 0) {
              mostrarMensaje('Se sincronizaron ' + exitosos.length + ' registro(s).', 'aviso');
            } else {
              mostrarMensaje('Se sincronizaron ' + exitosos.length + ' registro(s). ' + errores.length + ' quedaron pendientes por error: ' + errores.map((e) => e.error).join(', '));
            }
            renderizarLista();
          });
        })
        .catch(function () {
          mostrarMensaje('No se pudo sincronizar. Revisa tu conexion a internet.');
        });
    });
  }

  elBtnSincronizar.addEventListener('click', sincronizar);
  renderizarLista();
})();
