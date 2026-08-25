export class UpdateAbonadoDto {
  nombre_completo?: string; // nombre completo (física) o razón social (jurídica)
  nombre_representante_legal?: string; // solo jurídica
  telefono?: string;
  correo?: string;
  direccion?: string;
  numero_plano_catastrado?: string; // solo física, opcional
}
