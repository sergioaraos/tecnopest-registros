const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hola desde Node.js en Cloudways. PoC funcionando, ' + new Date().toISOString());
});

app.get('/test-pdf', async (req, res) => {
  try {
    const html = `
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: sans-serif;">
          <h1>Prueba de PDF con Puppeteer</h1>
          <p>Generado en Cloudways el ${new Date().toISOString()}</p>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="prueba.pdf"'
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando el PDF: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
