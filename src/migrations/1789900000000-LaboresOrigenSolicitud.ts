import { MigrationInterface, QueryRunner } from 'typeorm';

// Labores adicionales generadas automáticamente al aprobar una solicitud de
// conexión de servicio o de cambio de medidor: origen, enlace a la solicitud
// y copia de los datos operativos (abonado, dirección, NIS).
//
// Es idempotente a propósito: en desarrollo la app corre con synchronize:true,
// así que las columnas pueden existir antes de aplicar la migración. Si ya
// están, no se tocan.
export class LaboresOrigenSolicitud1789900000000 implements MigrationInterface {
  name = 'LaboresOrigenSolicitud1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabla = 'labores_adicionales';
    const columnas: string[] = [];

    if (!(await queryRunner.hasColumn(tabla, 'origen'))) {
      columnas.push(
        "ADD COLUMN `origen` ENUM('manual','solicitud') NOT NULL DEFAULT 'manual' AFTER `descripcion`",
      );
    }
    if (!(await queryRunner.hasColumn(tabla, 'id_solicitud'))) {
      columnas.push('ADD COLUMN `id_solicitud` INT NULL AFTER `origen`');
    }
    if (!(await queryRunner.hasColumn(tabla, 'datos_solicitud'))) {
      columnas.push('ADD COLUMN `datos_solicitud` JSON NULL AFTER `id_solicitud`');
    }
    if (columnas.length > 0) {
      await queryRunner.query(`ALTER TABLE \`${tabla}\` ${columnas.join(', ')};`);
    }

    const actualizada = await queryRunner.getTable(tabla);
    const tieneFk = actualizada?.foreignKeys.some((fk) =>
      fk.columnNames.includes('id_solicitud'),
    );
    if (!tieneFk) {
      await queryRunner.query(
        'ALTER TABLE `labores_adicionales` ADD CONSTRAINT `fk_labores_adicionales_solicitud` FOREIGN KEY (`id_solicitud`) REFERENCES `solicitudes`(`id`) ON DELETE SET NULL;',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tabla = 'labores_adicionales';
    const actual = await queryRunner.getTable(tabla);
    const fk = actual?.foreignKeys.find((f) =>
      f.columnNames.includes('id_solicitud'),
    );
    if (fk) {
      await queryRunner.query(
        `ALTER TABLE \`${tabla}\` DROP FOREIGN KEY \`${fk.name}\`;`,
      );
    }

    const columnas: string[] = [];
    for (const columna of ['datos_solicitud', 'id_solicitud', 'origen']) {
      if (await queryRunner.hasColumn(tabla, columna)) {
        columnas.push(`DROP COLUMN \`${columna}\``);
      }
    }
    if (columnas.length > 0) {
      await queryRunner.query(`ALTER TABLE \`${tabla}\` ${columnas.join(', ')};`);
    }
  }
}
