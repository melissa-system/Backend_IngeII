import { ValidateBy, ValidationOptions } from 'class-validator';
import {
  esCorreo,
  esFecha,
  esIdentificacion,
  esTelefono,
  mensajeIdentificacion,
  MENSAJES_VALIDACION,
  TipoIdentificacion,
} from './reglas-validacion';

// Decoradores de class-validator para las reglas comunes del sistema. Se usan
// en los DTOs igual que @IsEmail(): @EsCedula(), @EsTelefono(), @EsCorreo().
// Todos devuelven un mensaje claro en español.

export function EsCedula(
  tipos: TipoIdentificacion[] = ['fisica', 'juridica', 'dimex'],
  opciones?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'esCedula',
      constraints: [tipos],
      validator: {
        validate: (valor: unknown) => esIdentificacion(valor, tipos),
        defaultMessage: () => mensajeIdentificacion(tipos),
      },
    },
    opciones,
  );
}

export function EsTelefono(opciones?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'esTelefono',
      validator: {
        validate: (valor: unknown) => esTelefono(valor),
        defaultMessage: () => MENSAJES_VALIDACION.telefono,
      },
    },
    opciones,
  );
}

export function EsCorreo(opciones?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'esCorreo',
      validator: {
        validate: (valor: unknown) => esCorreo(valor),
        defaultMessage: () => MENSAJES_VALIDACION.correo,
      },
    },
    opciones,
  );
}

export function EsFecha(opciones?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'esFecha',
      validator: {
        validate: (valor: unknown) => esFecha(valor),
        defaultMessage: () => MENSAJES_VALIDACION.fecha,
      },
    },
    opciones,
  );
}
