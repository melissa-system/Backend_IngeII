import { MigrationInterface, QueryRunner } from 'typeorm';

// Documento firmado que se adjunta al aprobar una solicitud de paja de agua.
export class DocumentoAprobacionPajaAgua1789800000000 implements MigrationInterface {
  name = 'DocumentoAprobacionPajaAgua1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `solicitud_paja_agua` ADD COLUMN `documento_aprobacion_path` VARCHAR(500) NULL, ADD COLUMN `documento_aprobacion_public_id` VARCHAR(255) NULL;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `solicitud_paja_agua` DROP COLUMN `documento_aprobacion_path`, DROP COLUMN `documento_aprobacion_public_id`;',
    );
  }
}
