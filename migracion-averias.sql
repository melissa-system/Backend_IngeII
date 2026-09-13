-- ============================================================
-- Migración: Averías — preparar BD para el nuevo módulo
-- Ejecutar ANTES de arrancar el backend con los cambios nuevos.
-- TypeORM synchronize:true falla si hay datos viejos en el ENUM.
-- ============================================================

-- 1. Cambiar a VARCHAR temporalmente para poder actualizar libremente
ALTER TABLE averias MODIFY COLUMN tipo_averia VARCHAR(100) NOT NULL;

-- 2. Mapear datos existentes al nuevo ENUM
UPDATE averias SET tipo_averia = 'Fuga de agua' WHERE tipo_averia = 'Fuga';
UPDATE averias SET tipo_averia = 'Contador dañado' WHERE tipo_averia = 'Medidor dañado';

-- 3. Alterar al ENUM final (con acentos, igual que la entity de TypeORM)
ALTER TABLE averias MODIFY COLUMN tipo_averia ENUM(
  'Fuga de agua',
  'Tubería rota',
  'Falta de presión / sin agua',
  'Contador dañado',
  'Fuga en la vía pública',
  'Otro'
) NOT NULL;

-- 4. Agregar columnas nuevas (si no existen)
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'averias' AND COLUMN_NAME = 'ubicacion');
SET @sql = IF(@exists = 0,
  'ALTER TABLE averias ADD COLUMN ubicacion VARCHAR(255) NULL AFTER apellido2_reportante',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'averias' AND COLUMN_NAME = 'imagen_url');
SET @sql = IF(@exists = 0,
  'ALTER TABLE averias ADD COLUMN imagen_url VARCHAR(255) NULL AFTER ubicacion',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Agregar columna id_empleado si no existe
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'averias' AND COLUMN_NAME = 'id_empleado');
SET @sql = IF(@exists = 0,
  'ALTER TABLE averias ADD COLUMN id_empleado INT NULL AFTER fecha_reporte',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Crear tabla de historial (si no existe)
CREATE TABLE IF NOT EXISTS averias_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  averia_id INT NOT NULL,
  estado_anterior VARCHAR(50) NULL,
  estado_nuevo VARCHAR(50) NOT NULL,
  realizado_por VARCHAR(255) NOT NULL,
  observacion TEXT NULL,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (averia_id) REFERENCES averias(id) ON DELETE CASCADE
);
