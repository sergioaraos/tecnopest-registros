// SERGIO 2026-09-17: logica compartida por las pantallas del tecnico: registra el Service
// Worker (para que el formulario cargue sin conexion) y refresca los catalogos guardados en
// el telefono cuando hay conexion.
(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.error('No se pudo registrar el service worker', err);
    });
  }

  function refrescarCatalogos() {
    if (!navigator.onLine) return;
    fetch('/tecnico/catalogos')
      .then((resp) => {
        if (!resp.ok) throw new Error('respuesta no ok');
        return resp.json();
      })
      .then((catalogos) => window.TecnicoDB.guardarCatalogos(catalogos))
      .catch((err) => console.error('No se pudieron actualizar los catalogos', err));
  }

  refrescarCatalogos();
})();
