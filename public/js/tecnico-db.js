// SERGIO 2026-09-17: acceso a IndexedDB en el telefono del tecnico, para guardar los catalogos
// (clientes, direcciones, productos, tipos de servicio, operadores) y los registros de visita
// que se crean sin conexion, hasta que se sincronizan con el servidor.
(function (window) {
  const NOMBRE_DB = 'tecnopest-tecnico';
  const VERSION_DB = 1;

  function abrir() {
    return new Promise((resolve, reject) => {
      const peticion = indexedDB.open(NOMBRE_DB, VERSION_DB);

      peticion.onupgradeneeded = function () {
        const db = peticion.result;
        if (!db.objectStoreNames.contains('catalogos')) {
          db.createObjectStore('catalogos');
        }
        if (!db.objectStoreNames.contains('registrosPendientes')) {
          db.createObjectStore('registrosPendientes', { keyPath: 'idLocal' });
        }
      };

      peticion.onsuccess = function () {
        resolve(peticion.result);
      };

      peticion.onerror = function () {
        reject(peticion.error);
      };
    });
  }

  function guardarCatalogos(catalogos) {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('catalogos', 'readwrite');
      tx.objectStore('catalogos').put(catalogos, 'actual');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  function obtenerCatalogos() {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('catalogos', 'readonly');
      const peticion = tx.objectStore('catalogos').get('actual');
      peticion.onsuccess = () => resolve(peticion.result || null);
      peticion.onerror = () => reject(peticion.error);
    }));
  }

  function guardarRegistroPendiente(registro) {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('registrosPendientes', 'readwrite');
      tx.objectStore('registrosPendientes').put(registro);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  function listarRegistrosPendientes() {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('registrosPendientes', 'readonly');
      const peticion = tx.objectStore('registrosPendientes').getAll();
      peticion.onsuccess = () => resolve(peticion.result || []);
      peticion.onerror = () => reject(peticion.error);
    }));
  }

  function eliminarRegistroPendiente(idLocal) {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction('registrosPendientes', 'readwrite');
      tx.objectStore('registrosPendientes').delete(idLocal);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
  }

  window.TecnicoDB = {
    guardarCatalogos,
    obtenerCatalogos,
    guardarRegistroPendiente,
    listarRegistrosPendientes,
    eliminarRegistroPendiente
  };
})(window);
