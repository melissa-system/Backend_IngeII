import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RevisarReporteFontaneroDto {
  // true = resolución aprobada (la avería pasa a "Finalizado");
  // false = rechazada (la avería vuelve a "En proceso").
  @IsBoolean({ message: 'aprobado debe ser verdadero o falso.' })
  aprobado: boolean;

  @IsOptional()
  @IsString({ message: 'La observación debe ser texto.' })
  @MaxLength(1000, {
    message: 'La observación no puede superar los 1000 caracteres.',
  })
  observacion?: string;
}
