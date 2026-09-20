// SERGIO 2026-09-20: logica del selector de tema claro/oscuro/sistema, compartida por
// login.ejs, header.ejs (admin) y header-tecnico.ejs. La preferencia se guarda en el
// localStorage de cada dispositivo, no en el servidor. El bloqueo del parpadeo del tema
// equivocado al cargar la pagina esta en un script corto dentro de cada una de esas 3
// vistas (se ejecuta antes de este archivo, que solo maneja los botones).
(function () {
  function aplicar(valor) {
    if (valor === 'oscuro') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (valor === 'claro') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function marcarActivo(valor) {
    document.querySelectorAll('.boton-tema').forEach(function (b) {
      b.classList.toggle('activo', b.getAttribute('data-tema') === valor);
    });
  }

  var actual = 'sistema';
  try {
    actual = localStorage.getItem('tema') || 'sistema';
  } catch (e) {}
  marcarActivo(actual);

  document.querySelectorAll('.boton-tema').forEach(function (boton) {
    boton.addEventListener('click', function () {
      var valor = boton.getAttribute('data-tema');
      try { localStorage.setItem('tema', valor); } catch (e) {}
      aplicar(valor);
      marcarActivo(valor);
    });
  });
})();
