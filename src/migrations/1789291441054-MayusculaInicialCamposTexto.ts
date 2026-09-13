import { MigrationInterface, QueryRunner } from 'typeorm';

// Pedido de Meli: "que todo empiece con mayúscula, o que convierta de
// minúscula a mayúscula la primera... eso aplica para todo en el sistema".
//
// Se implementa con TRIGGERS de MySQL (BEFORE INSERT / BEFORE UPDATE) en
// vez de un CHECK constraint, porque un CHECK solo puede RECHAZAR una fila;
// no puede transformarla. Un trigger sí puede convertir "juan perez" en
// "Juan perez" al vuelo, sin importar si el dato entra por el backend, un
// script o un cliente de MySQL directo.
//
// Alcance acordado con Meli (ver conversación): SOLO texto libre pensado
// para mostrarse — nombres y apellidos de personas, direcciones físicas,
// títulos/contenido de publicaciones, nombres de documentos, descripciones
// y observaciones/justificaciones de averías y solicitudes.
//
// Deliberadamente EXCLUIDO (no se tocan, así vengan en minúscula):
//   - Correos, usuarios, contraseñas: no llevan mayúscula inicial por
//     convención y son sensibles a mayúsculas/minúsculas.
//   - Cédulas/identificaciones, teléfonos, códigos de solicitud: no son
//     texto en el sentido gramatical.
//   - URLs/paths de archivos (Cloudinary): no aplica.
//   - Columnas que en la práctica son catálogos cerrados aunque su tipo en
//     BD sea varchar (provincia/cantón/distrito, naturaleza del inmueble,
//     calidad del titular, tipo de servicio/conexión, motivo de falla del
//     medidor, categoría de publicación): ya llegan formateadas desde
//     selects del frontend; forzarlas con el trigger no cambiaría nada
//     (ya empiezan en mayúscula) pero se dejan fuera por prolijidad y para
//     no arriesgar comparaciones exactas en el código si cambiara el dato.
const CAMPOS_A_CAPITALIZAR: Record<string, string[]> = {
  abonados: ['nombre', 'direccion'],
  abonados_fisicos: ['apellido1', 'apellido2'],
  abonados_juridicos: ['nombre_representante_legal', 'representante_direccion'],
  averias: [
    'descripcion',
    'nombre_reportante',
    'apellido1_reportante',
    'apellido2_reportante',
  ],
  averias_historial: ['realizado_por', 'observacion'],
  configuracion: ['direccion'],
  documentos: ['nombre'],
  empleados: ['nombre', 'apellido1', 'apellido2'],
  publicaciones: ['titulo', 'contenido'],
  solicitud_paja_agua: [
    'nombre_solicitante',
    'nombre_representante',
    'direccion',
    'observaciones',
  ],
  solicitud_cambio_domicilio: [
    'direccion_anterior',
    'direccion_nueva',
    'justificacion',
    'motivo_rechazo',
  ],
  solicitud_cambio_medidor: ['direccion_exacta', 'justificacion', 'motivo_rechazo'],
  solicitud_cambio_representante: [
    'representante_anterior_nombre',
    'representante_nuevo_nombre',
    'representante_nuevo_direccion',
    'justificacion',
    'motivo_rechazo',
  ],
  solicitud_otro: ['asunto', 'justificacion', 'motivo_rechazo'],
};

function nombreTrigger(tabla: string, momento: 'bi' | 'bu'): string {
  return `trg_${tabla}_mayuscula_${momento}`;
}

// Por cada columna: si no es NULL ni cadena vacía, reemplaza su primer
// carácter por la versión en mayúscula (deja el resto del texto intacto,
// así que "juan PEREZ" queda "Juan PEREZ", no fuerza todo a mayúsculas).
function cuerpoTrigger(columnas: string[]): string {
  return columnas
    .map(
      (columna) => `
    IF NEW.\`${columna}\` IS NOT NULL AND NEW.\`${columna}\` <> '' THEN
      SET NEW.\`${columna}\` = CONCAT(UPPER(LEFT(NEW.\`${columna}\`, 1)), SUBSTRING(NEW.\`${columna}\`, 2));
    END IF;`,
    )
    .join('');
}

export class MayusculaInicialCamposTexto1789291441054
  implements MigrationInterface
{
  name = 'MayusculaInicialCamposTexto1789291441054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columnas] of Object.entries(CAMPOS_A_CAPITALIZAR)) {
      const cuerpo = cuerpoTrigger(columnas);

      await queryRunner.query(`
        CREATE TRIGGER \`${nombreTrigger(tabla, 'bi')}\`
        BEFORE INSERT ON \`${tabla}\`
        FOR EACH ROW
        BEGIN${cuerpo}
        END
      `);

      await queryRunner.query(`
        CREATE TRIGGER \`${nombreTrigger(tabla, 'bu')}\`
        BEFORE UPDATE ON \`${tabla}\`
        FOR EACH ROW
        BEGIN${cuerpo}
        END
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of Object.keys(CAMPOS_A_CAPITALIZAR)) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS \`${nombreTrigger(tabla, 'bi')}\``,
      );
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS \`${nombreTrigger(tabla, 'bu')}\``,
      );
    }
  }
}
