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

  // Confirma explícitamente que se quiere registrar como abonado a alguien
  // cuya cédula ya existe como empleado (ej. un miembro de la Junta que
  // también es abonado). Sin este flag, esa combinación se rechaza para
  // evitar duplicados accidentales; con él, se permite (ver
  // AbonadosService.verificarCedulaNoUsadaPorEmpleado).
  confirmarVinculacion?: boolean;
}
