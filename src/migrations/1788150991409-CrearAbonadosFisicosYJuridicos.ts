import { MigrationInterface, QueryRunner } from 'typeorm';

// Normaliza `abonados` en tabla base + subtablas por tipo:
//   - abonados_fisicos: campos exclusivos de persona física
//     (apellido1, apellido2, numero_plano_catastrado).
//   - abonados_juridicos: campos exclusivos de persona jurídica
//     (nombre_representante_legal, cedula_representante).
//
// IMPORTANTE sobre el orden de aplicación (ver conversación con Meli):
// esta migración se debe correr con `npm run migration:run` ANTES de
// desplegar el código que ya trae abonado.entity.ts actualizado (sin
// nombre_completo/nombre_representante_legal/numero_plano_catastrado).
// Si el código nuevo arranca primero con synchronize:true todavía
// apuntando a la BD vieja, TypeORM no sabe que "nombre_completo" se
// renombró a "nombre": haría DROP de nombre_completo (perdiendo todos
// los nombres existentes) y CREATE de una columna nombre vacía. Esta
// migración usa CHANGE COLUMN (rename real, sin pérdida de datos) y
// copia los datos existentes a las subtablas antes de quitar columnas
// de la tabla base.
//
// apellido1/apellido2 quedan NULL para los abonados física existentes:
// no hay forma segura de partir automáticamente el nombre_completo viejo
// en nombre/apellido1/apellido2 sin arriesgarse a cortar mal un nombre
// compuesto o un apellido con "de/del/de la". Hay que completarlos a mano
// para los registros que ya existían antes de este cambio.
//
// cedula_representante es un campo nuevo (no existía en abonados antes),
// así que también queda NULL para los jurídicos existentes.
export class CrearAbonadosFisicosYJuridicos1788150991409
  implements MigrationInterface
{
  name = 'CrearAbonadosFisicosYJuridicos1788150991409';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`abonados_fisicos\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`abonado_id\` int NOT NULL,
        \`apellido1\` varchar(255) NULL,
        \`apellido2\` varchar(255) NULL,
        \`numero_plano_catastrado\` varchar(255) NULL,
        UNIQUE INDEX \`REL_abonados_fisicos_abonado_id\` (\`abonado_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`abonados_juridicos\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`abonado_id\` int NOT NULL,
        \`nombre_representante_legal\` varchar(255) NULL,
        \`cedula_representante\` varchar(255) NULL,
        UNIQUE INDEX \`REL_abonados_juridicos_abonado_id\` (\`abonado_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE \`abonados_fisicos\`
      ADD CONSTRAINT \`FK_abonados_fisicos_abonado\`
      FOREIGN KEY (\`abonado_id\`) REFERENCES \`abonados\`(\`id\`)
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`abonados_juridicos\`
      ADD CONSTRAINT \`FK_abonados_juridicos_abonado\`
      FOREIGN KEY (\`abonado_id\`) REFERENCES \`abonados\`(\`id\`)
      ON DELETE CASCADE
    `);

    // Copiar datos existentes a la subtabla que corresponda ANTES de
    // quitar las columnas viejas de la tabla base.
    await queryRunner.query(`
      INSERT INTO \`abonados_fisicos\` (\`abonado_id\`, \`numero_plano_catastrado\`)
      SELECT \`id\`, \`numero_plano_catastrado\`
      FROM \`abonados\`
      WHERE \`tipo_abonado\` = 'Física'
    `);

    await queryRunner.query(`
      INSERT INTO \`abonados_juridicos\` (\`abonado_id\`, \`nombre_representante_legal\`)
      SELECT \`id\`, \`nombre_representante_legal\`
      FROM \`abonados\`
      WHERE \`tipo_abonado\` = 'Jurídica'
    `);

    // Quitar de la tabla base lo que ya vive en las subtablas.
    await queryRunner.query(`
      ALTER TABLE \`abonados\` DROP COLUMN \`nombre_representante_legal\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`abonados\` DROP COLUMN \`numero_plano_catastrado\`
    `);

    // Rename real (CHANGE COLUMN), no se pierde el valor existente.
    await queryRunner.query(`
      ALTER TABLE \`abonados\`
      CHANGE COLUMN \`nombre_completo\` \`nombre\` varchar(255) NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`abonados\`
      CHANGE COLUMN \`nombre\` \`nombre_completo\` varchar(255) NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`abonados\` ADD COLUMN \`nombre_representante_legal\` varchar(255) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE \`abonados\` ADD COLUMN \`numero_plano_catastrado\` varchar(255) NULL
    `);

    await queryRunner.query(`
      UPDATE \`abonados\` a
      JOIN \`abonados_fisicos\` af ON af.\`abonado_id\` = a.\`id\`
      SET a.\`numero_plano_catastrado\` = af.\`numero_plano_catastrado\`
    `);

    await queryRunner.query(`
      UPDATE \`abonados\` a
      JOIN \`abonados_juridicos\` aj ON aj.\`abonado_id\` = a.\`id\`
      SET a.\`nombre_representante_legal\` = aj.\`nombre_representante_legal\`
    `);

    await queryRunner.query(`ALTER TABLE \`abonados_fisicos\` DROP FOREIGN KEY \`FK_abonados_fisicos_abonado\``);
    await queryRunner.query(`ALTER TABLE \`abonados_juridicos\` DROP FOREIGN KEY \`FK_abonados_juridicos_abonado\``);
    await queryRunner.query(`DROP TABLE \`abonados_fisicos\``);
    await queryRunner.query(`DROP TABLE \`abonados_juridicos\``);
  }
}
