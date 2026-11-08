import { MigrationInterface, QueryRunner } from 'typeorm';

// Trazabilidad de la notificación por correo del resultado (aprobada /
// rechazada) de las solicitudes: estado del envío ('enviada', 'fallida' u
// 'omitida'), fecha y, si falló, el motivo. Se agrega a la tabla genérica
// `solicitudes` (5 tipos de trámite) y a `solicitud_paja_agua`.
export class NotificacionResultadoSolicitudes1789600000000 implements MigrationInterface {
  name = 'NotificacionResultadoSolicitudes1789600000000';

  private readonly tablas = ['solicitudes', 'solicitud_paja_agua'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of this.tablas) {
      await queryRunner.query(
        `ALTER TABLE \`${tabla}\`
         ADD COLUMN \`notificacion_estado\` VARCHAR(20) NULL,
         ADD COLUMN \`notificacion_fecha\` DATETIME NULL,
         ADD COLUMN \`notificacion_error\` VARCHAR(255) NULL;`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of this.tablas) {
      await queryRunner.query(
        `ALTER TABLE \`${tabla}\`
         DROP COLUMN \`notificacion_error\`,
         DROP COLUMN \`notificacion_fecha\`,
         DROP COLUMN \`notificacion_estado\`;`,
      );
    }
  }
}
