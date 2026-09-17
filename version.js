// SERGIO 2026-09-17: informacion de version mostrada en el pie de las paginas y en la ruta "/",
// para poder confirmar rapido si un despliegue nuevo (por ejemplo en Cloudways) quedo activo.
// Lee el commit actual directamente de la carpeta .git, sin depender de tener git instalado.
const fs = require('fs');
const path = require('path');

function commitActual() {
  try {
    const gitDir = path.join(__dirname, '.git');
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();

    if (!head.startsWith('ref: ')) {
      return head.slice(0, 7);
    }

    const ref = head.slice(5).trim();
    const refPath = path.join(gitDir, ref);
    if (fs.existsSync(refPath)) {
      return fs.readFileSync(refPath, 'utf8').trim().slice(0, 7);
    }

    const packedRefs = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
    const linea = packedRefs.split('\n').find((l) => l.endsWith(' ' + ref));
    return linea ? linea.split(' ')[0].slice(0, 7) : 'desconocido';
  } catch (err) {
    return 'desconocido';
  }
}

const COMMIT = commitActual();
const INICIO_SERVIDOR = new Date().toISOString();

module.exports = { COMMIT, INICIO_SERVIDOR };
