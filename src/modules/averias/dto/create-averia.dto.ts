export class CreateAveriaDto {
  nombreReportante: string;
  telefono: string;
  cedula?: string;
  ubicacion: string;
  descripcion: string;
  tipoAveria?: string;
  // Nombre dividido: lo que realmente lee AveriasService.create() del body
  // (whitelist:false en el ValidationPipe global deja pasar estos campos
  // aunque no coincidan exactamente con los de arriba).
  nombre_reportante?: string;
  apellido1_reportante?: string;
  apellido2_reportante?: string;
  cedula_reportante?: string;
}