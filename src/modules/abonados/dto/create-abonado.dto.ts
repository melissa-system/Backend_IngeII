export class CreateAbonadoDto {
  tipo_abonado: string; // 'Física' o 'Jurídica'

  nombre: string; // nombre de pila (física) o razón social (jurídica)

  // Solo física (van a abonados_fisicos)
  apellido1?: string;
  apellido2?: string;
  numero_plano_catastrado?: string;

  // Solo jurídica (van a abonados_juridicos)
  nombre_representante_legal?: string;
  cedula_representante?: string;

  cedula: string; // cédula física o cédula jurídica
  telefono: string;
  correo: string;
  direccion: string;
}
