import { MigrationInterface, QueryRunner } from 'typeorm';

// El número de disponibilidad ya no lo captura el solicitante: lo completa el
// administrador, por lo que la columna pasa a admitir NULL.
export class NumeroDisponibilidadOpcional1789700000000 implements MigrationInterface {
  name = 'NumeroDisponibilidadOpcional1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `solicitud_conexion_paja_agua` MODIFY `numero_disponibilidad` VARCHAR(100) NULL;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `solicitud_conexion_paja_agua` SET `numero_disponibilidad` = '' WHERE `numero_disponibilidad` IS NULL;",
    );
    await queryRunner.query(
      'ALTER TABLE `solicitud_conexion_paja_agua` MODIFY `numero_disponibilidad` VARCHAR(100) NOT NULL;',
    );
  }
}
