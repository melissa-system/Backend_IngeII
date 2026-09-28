import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrearModuloInventario1789400000000 implements MigrationInterface {
  name = 'CrearModuloInventario1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`proveedores\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`nombre\` varchar(200) NOT NULL,
        \`tipo\` varchar(50) NOT NULL DEFAULT 'Jurídico',
        \`contacto\` varchar(150) NULL,
        \`telefono\` varchar(50) NULL,
        \`correo\` varchar(150) NULL,
        \`direccion\` varchar(255) NULL,
        \`estado\` varchar(50) NOT NULL DEFAULT 'Activo',
        \`fecha_creacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`fecha_actualizacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`articulos\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`nombre\` varchar(150) NOT NULL,
        \`descripcion\` text NOT NULL,
        \`clasificacion\` varchar(50) NOT NULL DEFAULT 'articulo',
        \`cantidad_disponible\` int NOT NULL DEFAULT 0,
        \`fecha_ingreso\` date NOT NULL,
        \`ubicacion\` varchar(255) NOT NULL,
        \`persona_recibe\` varchar(150) NOT NULL,
        \`estado\` varchar(50) NOT NULL DEFAULT 'activo',
        \`proveedor_id\` int NOT NULL,
        \`fecha_creacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`fecha_actualizacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_articulos_proveedor\` FOREIGN KEY (\`proveedor_id\`) REFERENCES \`proveedores\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`movimientos_inventario\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`articulo_id\` int NOT NULL,
        \`tipo_movimiento\` varchar(50) NOT NULL,
        \`cantidad\` int NOT NULL,
        \`responsable_destino\` varchar(255) NULL,
        \`motivo\` varchar(255) NOT NULL,
        \`usuario_id\` int NULL,
        \`nombre_persona_registro\` varchar(150) NULL,
        \`fecha_movimiento\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_movimientos_articulo\` FOREIGN KEY (\`articulo_id\`) REFERENCES \`articulos\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Insertar proveedores iniciales para que el sistema tenga opciones disponibles de inmediato
    await queryRunner.query(`
      INSERT INTO \`proveedores\` (\`id\`, \`nombre\`, \`tipo\`, \`contacto\`, \`telefono\`, \`correo\`, \`direccion\`, \`estado\`)
      VALUES
        (1, 'Distribuidora Ferretera CR', 'Jurídico', 'Luis Herrera', '2277-1010', 'ventas@distferretera.cr', 'San José, centro comercial', 'Activo'),
        (2, 'HidroTech S.A.', 'Jurídico', 'Marta Jiménez', '2288-2020', 'ventas@hidrotech.cr', 'Heredia, Industrial Park', 'Activo'),
        (3, 'Ferretería El Constructor', 'Jurídico', 'Carlos Mora', '2277-3030', 'pedidos@elconstructor.cr', 'Alajuela, frente al parque', 'Activo')
      ON DUPLICATE KEY UPDATE \`nombre\` = VALUES(\`nombre\`);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`movimientos_inventario\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`articulos\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`proveedores\`;`);
  }
}

