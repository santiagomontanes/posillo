-- ==============================
-- Sistetecni POS - Setup completo
-- Crea DB + usuario + permisos + tablas + admin + invoice counter
-- ==============================

-- 1) Crear base de datos
CREATE DATABASE IF NOT EXISTS sistetecni_pos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE sistetecni_pos;

-- 2) Crear usuario de app (cambia la clave si quieres)
--    OJO: Si ya existe, no falla.
CREATE USER IF NOT EXISTS 'pos_user'@'%' IDENTIFIED BY 'admin';

-- 3) Permisos mínimos necesarios
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON sistetecni_pos.* TO 'pos_user'@'%';

FLUSH PRIVILEGES;

-- 4) Tablas (ajusta si tu esquema final tiene más)
CREATE TABLE IF NOT EXISTS users (
  id varchar(36) NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL,
  created_at varchar(30) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS products (
  id varchar(36) NOT NULL,
  brand varchar(255) NOT NULL,
  model varchar(255) NOT NULL,
  cpu varchar(255) NOT NULL,
  ram_gb int NOT NULL,
  storage varchar(255) NOT NULL,
  `condition` varchar(255) NOT NULL,
  purchase_price int NOT NULL,
  sale_price int NOT NULL,
  stock int NOT NULL,
  notes text,
  active tinyint NOT NULL DEFAULT '1',
  created_at varchar(30) NOT NULL,
  updated_at varchar(30) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sales (
  id varchar(36) NOT NULL,
  invoice_number varchar(50) NOT NULL,
  date varchar(30) NOT NULL,
  user_id varchar(36) NOT NULL,
  payment_method varchar(50) NOT NULL,
  subtotal int NOT NULL,
  discount int NOT NULL,
  total int NOT NULL,
  customer_name varchar(255) DEFAULT NULL,
  customer_id varchar(255) DEFAULT NULL,
  created_at varchar(30) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY invoice_number (invoice_number),
  KEY user_id (user_id),
  CONSTRAINT sales_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  id varchar(36) NOT NULL,
  sale_id varchar(36) NOT NULL,
  product_id varchar(36) DEFAULT NULL,
  qty int NOT NULL,
  unit_price int NOT NULL,
  line_total int NOT NULL,
  description text,
  unit_cost decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (id),
  KEY sale_id (sale_id),
  KEY product_id (product_id),
  CONSTRAINT sale_items_ibfk_1 FOREIGN KEY (sale_id) REFERENCES sales (id),
  CONSTRAINT sale_items_ibfk_2 FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS cash_closures (
  id varchar(36) NOT NULL,
  opened_at datetime DEFAULT NULL,
  opened_by varchar(36) DEFAULT NULL,
  opening_cash decimal(12,2) DEFAULT NULL,
  opening_notes text,
  closed_at datetime DEFAULT NULL,
  closed_by varchar(36) DEFAULT NULL,
  counted_cash decimal(12,2) DEFAULT NULL,
  expected_cash decimal(12,2) DEFAULT NULL,
  total_sales decimal(12,2) DEFAULT NULL,
  total_expenses decimal(12,2) DEFAULT NULL,
  difference decimal(12,2) DEFAULT NULL,
  notes text,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id varchar(36) NOT NULL,
  date datetime DEFAULT NULL,
  concept varchar(200) DEFAULT NULL,
  amount decimal(12,2) DEFAULT NULL,
  notes text,
  created_at datetime DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id varchar(36) NOT NULL,
  actor_user_id varchar(36) NOT NULL,
  action varchar(50) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id varchar(36) DEFAULT NULL,
  metadata text,
  created_at datetime NOT NULL,
  PRIMARY KEY (id),
  KEY actor_user_id (actor_user_id),
  CONSTRAINT audit_logs_ibfk_1 FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS invoice_counters (
  `year` int NOT NULL,
  last_number int NOT NULL DEFAULT '0',
  seq int NOT NULL DEFAULT '0',
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5) Seed: admin inicial (si no existe)
--    Cambia el hash por el que generaste con bcryptjs
INSERT INTO users (id, name, email, password_hash, role, created_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'admin@sistetecni.com',
  'PON_AQUI_EL_HASH',
  'ADMIN',
  DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s.000Z')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@sistetecni.com');

-- 6) Asegurar contador del año actual
INSERT INTO invoice_counters (`year`, last_number, seq)
VALUES (YEAR(NOW()), 0, 0)
ON DUPLICATE KEY UPDATE `year` = `year`;