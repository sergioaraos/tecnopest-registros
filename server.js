const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
 
app.get('/', (req, res) => {
  res.send('Hola desde Node.js en Cloudways. PoC funcionando, ' + new Date().toISOString());
});
 
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
 