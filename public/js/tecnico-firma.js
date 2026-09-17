// SERGIO 2026-09-17: captura de firma dibujada con el dedo (o mouse) sobre un canvas, usada
// para la firma del tecnico y la firma del cliente en el formulario de Registro de Visita.
(function (window) {
  function inicializar(canvas) {
    const contexto = canvas.getContext('2d');
    let dibujando = false;
    let vacio = true;

    function ajustarTamano() {
      const relacion = window.devicePixelRatio || 1;
      const ancho = canvas.clientWidth;
      const alto = canvas.clientHeight;
      canvas.width = ancho * relacion;
      canvas.height = alto * relacion;
      contexto.scale(relacion, relacion);
      contexto.lineWidth = 2;
      contexto.lineCap = 'round';
      contexto.strokeStyle = '#000';
    }

    function posicion(evento) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: evento.clientX - rect.left,
        y: evento.clientY - rect.top
      };
    }

    function iniciarTrazo(evento) {
      dibujando = true;
      vacio = false;
      const p = posicion(evento);
      contexto.beginPath();
      contexto.moveTo(p.x, p.y);
      evento.preventDefault();
    }

    function continuarTrazo(evento) {
      if (!dibujando) return;
      const p = posicion(evento);
      contexto.lineTo(p.x, p.y);
      contexto.stroke();
      evento.preventDefault();
    }

    function terminarTrazo(evento) {
      dibujando = false;
      if (evento) evento.preventDefault();
    }

    ajustarTamano();
    canvas.addEventListener('pointerdown', iniciarTrazo);
    canvas.addEventListener('pointermove', continuarTrazo);
    window.addEventListener('pointerup', terminarTrazo);

    return {
      limpiar: function () {
        contexto.clearRect(0, 0, canvas.width, canvas.height);
        vacio = true;
      },
      estaVacio: function () {
        return vacio;
      },
      obtenerDataUrl: function () {
        return canvas.toDataURL('image/png');
      }
    };
  }

  window.TecnicoFirma = { inicializar };
})(window);
