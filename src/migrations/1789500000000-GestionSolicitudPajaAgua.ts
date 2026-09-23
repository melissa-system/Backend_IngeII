import { MigrationInterface, QueryRunner } from 'typeorm';

// Habilita la gestión de estado (Marcar en proceso / Aprobar / Rechazar) de
// la solicitud pública de paja de agua, que hasta ahora era de solo lectura
// en el dashboard admin:
//   1. Agrega 'En proceso' al enum de estado (ya existían Pendiente,
//      Aprobada, Rechazada, Completada).
//   2. Agrega motivo_rechazo, para documentar por qué se rechazó (igual que
//      en las demás solicitudes).
//   3. Agrega abonado_id: al aprobar, se crea (o reutiliza) el Abonado
//      correspondiente y queda enlazado acá, para poder habilitarle después
//      la "Solicitud de conexión de paja de agua" desde su dashboard.
export class GestionSolicitudPajaAgua1789500000000
  implements MigrationInterface
{
  name = 'GestionSolicitudPajaAgua1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\`
       MODIFY COLUMN \`estado\` ENUM('Pendiente', 'En proceso', 'Aprobada', 'Rechazada', 'Completada')
       NOT NULL DEFAULT 'Pendiente';`,
    );

    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\`
       ADD COLUMN \`motivo_rechazo\` TEXT NULL AFTER \`estado\`;`,
    );

    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\`
       ADD COLUMN \`abonado_id\` INT NULL AFTER \`id_empleado\`;`,
    );

    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\`
       ADD CONSTRAINT \`fk_solicitud_paja_agua_abonado\`
       FOREIGN KEY (\`abonado_id\`) REFERENCES \`abonados\`(\`id\`)
       ON DELETE SET NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\` DROP FOREIGN KEY \`fk_solicitud_paja_agua_abonado\`;`,
    );
    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\` DROP COLUMN \`abonado_id\`;`,
    );
    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\` DROP COLUMN \`motivo_rechazo\`;`,
    );
    await queryRunner.query(
      `UPDATE \`solicitud_paja_agua\` SET \`estado\` = 'Pendiente' WHERE \`estado\` = 'En proceso';`,
    );
    await queryRunner.query(
      `ALTER TABLE \`solicitud_paja_agua\`
       MODIFY COLUMN \`estado\` ENUM('Pendiente', 'Aprobada', 'Rechazada', 'Completada')
       NOT NULL DEFAULT 'Pendiente';`,
    );
  }
}
