import { MigrationInterface, QueryRunner } from 'typeorm';

// Solicitudes de material que hace el fontanero antes de atender un trabajo:
// cabecera + detalle. Al aprobarlas se descuenta stock (movimientos de
// inventario) y hasta entonces el fontanero no puede iniciar la gestión.
//
// Idempotente: en desarrollo la app corre con synchronize:true, así que las
// tablas pueden existir antes de aplicar la migración.
export class SolicitudesMaterial1790000000000 implements MigrationInterface {
  name = 'SolicitudesMaterial1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('solicitudes_material'))) {
      await queryRunner.query(`
        CREATE TABLE \`solicitudes_material\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`codigo_solicitud_material\` varchar(255) NOT NULL,
          \`id_empleado\` int NOT NULL,
          \`id_averia\` int NULL,
          \`id_labor\` int NULL,
          \`estado\` enum('Pendiente','Aprobada','Rechazada','Cancelada') NOT NULL DEFAULT 'Pendiente',
          \`motivo\` text NOT NULL,
          \`motivo_rechazo\` text NULL,
          \`id_revisado_por\` int NULL,
          \`fecha_revision\` datetime NULL,
          \`fecha_creacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`fecha_actualizacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          UNIQUE INDEX \`IDX_solicitudes_material_codigo\` (\`codigo_solicitud_material\`),
          INDEX \`IDX_solicitudes_material_estado\` (\`estado\`),
          INDEX \`IDX_solicitudes_material_fecha_creacion\` (\`fecha_creacion\`),
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`FK_solicitudes_material_empleado\` FOREIGN KEY (\`id_empleado\`) REFERENCES \`empleados\`(\`id\`) ON DELETE NO ACTION,
          CONSTRAINT \`FK_solicitudes_material_averia\` FOREIGN KEY (\`id_averia\`) REFERENCES \`averias\`(\`id\`) ON DELETE SET NULL,
          CONSTRAINT \`FK_solicitudes_material_labor\` FOREIGN KEY (\`id_labor\`) REFERENCES \`labores_adicionales\`(\`id\`) ON DELETE SET NULL,
          CONSTRAINT \`FK_solicitudes_material_revisado_por\` FOREIGN KEY (\`id_revisado_por\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB;
      `);
    }

    if (!(await queryRunner.hasTable('solicitud_material_detalles'))) {
      await queryRunner.query(`
        CREATE TABLE \`solicitud_material_detalles\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`id_solicitud_material\` int NOT NULL,
          \`id_articulo\` int NULL,
          \`descripcion_libre\` varchar(150) NULL,
          \`unidad\` varchar(30) NULL,
          \`cantidad\` int NOT NULL,
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`FK_solicitud_material_detalles_solicitud\` FOREIGN KEY (\`id_solicitud_material\`) REFERENCES \`solicitudes_material\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_solicitud_material_detalles_articulo\` FOREIGN KEY (\`id_articulo\`) REFERENCES \`articulos\`(\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB;
      `);
    }

    // Nuevo módulo en la bitácora (MODIFY es idempotente).
    await queryRunner.query(
      "ALTER TABLE `bitacora` MODIFY COLUMN `modulo` ENUM('abonados','solicitudes','averias','inventario','usuarios','empleados','documentos','publicaciones','configuracion','reportes_fontanero','labores_adicionales','solicitudes_material') NOT NULL;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `solicitud_material_detalles`;');
    await queryRunner.query('DROP TABLE IF EXISTS `solicitudes_material`;');
    await queryRunner.query(
      "ALTER TABLE `bitacora` MODIFY COLUMN `modulo` ENUM('abonados','solicitudes','averias','inventario','usuarios','empleados','documentos','publicaciones','configuracion','reportes_fontanero','labores_adicionales') NOT NULL;",
    );
  }
}
