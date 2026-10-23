import { MigrationInterface, QueryRunner } from 'typeorm';

// Origen del reporte de fontanero: asignado (viene de una avería o labor) o
// no asignado (el fontanero lo registró por su cuenta, sin trabajo). Los
// reportes viejos quedan como 'asignado'.
export class OrigenReporteFontanero1790100000000 implements MigrationInterface {
  name = 'OrigenReporteFontanero1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reportes_fontanero', 'origen')) return;
    await queryRunner.query(
      "ALTER TABLE `reportes_fontanero` ADD COLUMN `origen` ENUM('asignado','no_asignado') NOT NULL DEFAULT 'asignado' AFTER `tipo_actividad`;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('reportes_fontanero', 'origen'))) return;
    await queryRunner.query(
      'ALTER TABLE `reportes_fontanero` DROP COLUMN `origen`;',
    );
  }
}
