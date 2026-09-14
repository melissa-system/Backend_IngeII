import { MigrationInterface, QueryRunner } from 'typeorm';

export class EliminarTablaCambioDomicilio1789300000000
  implements MigrationInterface
{
  name = 'EliminarTablaCambioDomicilio1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar triggers asociados a solicitud_cambio_domicilio si existen
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_solicitud_cambio_domicilio_mayuscula_bi;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_solicitud_cambio_domicilio_mayuscula_bu;`,
    );

    // 2. Eliminar la tabla de detalle solicitud_cambio_domicilio
    await queryRunner.query(`DROP TABLE IF EXISTS \`solicitud_cambio_domicilio\`;`);

    // 3. Eliminar solicitudes huérfanas de tipo 'cambio_domicilio' en la tabla base
    await queryRunner.query(
      `DELETE FROM \`solicitudes\` WHERE \`tipo_solicitud\` = 'cambio_domicilio';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: el trámite fue eliminado completamente del sistema
  }
}

