// SERGIO 2026-09-16: ruta de prueba para descargar el .docx de un certificado, generado al
// vuelo (sin guardar copia en el servidor).
const express = require('express');
const { generarCertificadoDocx } = require('../services/certificado');
const { requireAuth } = require('../middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  router.get('/:id/docx', requireAuth, (req, res) => {
    try {
      const buffer = generarCertificadoDocx(db, req.params.id);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="certificado-${req.params.id}.docx"`
      });
      res.send(buffer);
    } catch (err) {
      console.error(err);
      res.status(404).json({ error: err.message });
    }
  });

  return router;
};
