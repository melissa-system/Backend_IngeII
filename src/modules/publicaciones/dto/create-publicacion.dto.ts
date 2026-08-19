export class CreatePublicacionDto {
  titulo: string;
  contenido: string;
  categoria: string; // Ej: 'Aviso', 'Comunicado', 'Mantenimiento'
  publicado?: boolean; // opcional, por defecto true (visible en el landing)
}
