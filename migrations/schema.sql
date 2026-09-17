-- SERGIO 2026-09-16: Esquema inicial de la base de datos SQLite para TecnoPest Registros y Certificados.
-- Incluye usuarios/roles, clientes, direcciones, catalogo de servicios y productos, operadores,
-- registros de visita (con sus lineas de producto y operadores) y certificados.

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('tecnico', 'administrador')),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razon_social TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE,
  representante TEXT,
  rut_representante TEXT,
  direccion_representante TEXT,
  comuna_representante TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS direcciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  nombre TEXT,
  direccion_linea_1 TEXT NOT NULL,
  direccion_linea_2 TEXT,
  comuna TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tipos_servicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_servicio_id INTEGER NOT NULL REFERENCES tipos_servicio(id),
  nombre TEXT NOT NULL,
  componente_principal TEXT,
  registro_isp TEXT,
  disolucion_estandar TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS operadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1
);

-- SERGIO 2026-09-16: un certificado corresponde siempre a una sola direccion del cliente
CREATE TABLE IF NOT EXISTS certificados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero INTEGER NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  direccion_id INTEGER NOT NULL REFERENCES direcciones(id),
  fecha_aplicacion TEXT NOT NULL,
  recomendaciones TEXT,
  diagnostico_previo TEXT,
  creado_por INTEGER NOT NULL REFERENCES usuarios(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SERGIO 2026-09-17: hora_apertura_formulario / hora_guardado_formulario son marcas
-- automaticas tomadas del reloj del telefono (al abrir el formulario y al guardar), solo
-- para control interno. horario_ingreso / horario_salida son los que el tecnico ingresa a
-- mano y los que se muestran en el certificado.
CREATE TABLE IF NOT EXISTS registros_visita (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  direccion_id INTEGER NOT NULL REFERENCES direcciones(id),
  tecnico_id INTEGER NOT NULL REFERENCES usuarios(id),
  horario_ingreso TEXT NOT NULL,
  horario_salida TEXT NOT NULL,
  hora_apertura_formulario TEXT NOT NULL,
  hora_guardado_formulario TEXT NOT NULL,
  observaciones TEXT,
  firma_tecnico_path TEXT,
  firma_cliente_path TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'certificado')),
  certificado_id INTEGER REFERENCES certificados(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registro_operadores (
  registro_id INTEGER NOT NULL REFERENCES registros_visita(id),
  operador_id INTEGER NOT NULL REFERENCES operadores(id),
  PRIMARY KEY (registro_id, operador_id)
);

CREATE TABLE IF NOT EXISTS registro_productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_id INTEGER NOT NULL REFERENCES registros_visita(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad_real TEXT,
  zona_aplicacion TEXT
);

-- SERGIO 2026-09-16: indices para las consultas mas frecuentes (listar por cliente, filtrar por estado, etc.)
CREATE INDEX IF NOT EXISTS idx_direcciones_cliente ON direcciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_registros_cliente ON registros_visita(cliente_id);
CREATE INDEX IF NOT EXISTS idx_registros_estado ON registros_visita(estado);
CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos(tipo_servicio_id);
