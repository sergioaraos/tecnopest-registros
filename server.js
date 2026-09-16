const express = require('express');
const PDFDocument = require('pdfkit');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hola desde Node.js en Cloudways. PoC funcionando, ' + new Date().toISOString());
});

app.get('/test-pdf', (req, res) => {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="prueba.pdf"'
    });
    doc.pipe(res);

    doc.fontSize(20).text('Prueba de PDF con pdfkit', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Generado en Cloudways el ' + new Date().toISOString());
    doc.moveDown();

    doc.fontSize(14).text('Prueba de tabla simple:');
    doc.moveDown(0.5);

    const startY = doc.y;
    const colWidths = [150, 150, 150];
    const rows = [
      ['Producto', 'Disolución', 'Cantidad'],
      ['Cyperkill', '80cc/10L', '100cc'],
      ['Dryquat', '50cc/10L', '30cc']
    ];

    let y = startY;
    rows.forEach((row, rowIndex) => {
      let x = 50;
      row.forEach((cell, colIndex) => {
        doc.rect(x, y, colWidths[colIndex], 20).stroke();
        doc.fontSize(10).text(cell, x + 5, y + 5, { width: colWidths[colIndex] - 10 });
        x += colWidths[colIndex];
      });
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando el PDF: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
