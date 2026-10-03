// Reglas de validación comunes a todo el sistema (PBI 511). Cédula,
// teléfono y correo se validan igual en todos los módulos: los DTOs usan los
// decoradores de decoradores-validacion.ts y los servicios estas funciones,
// así ninguna regla queda escrita dos veces con criterios distintos.
//
// El frontend replica exactamente las mismas expresiones en
// src/lib/validaciones.ts.

// Cédula física: 9 dígitos, con o sin guiones (X-XXXX-XXXX).
export const REGEX_CEDULA_FISICA = /^\d-?\d{4}-?\d{4}$/;
// Cédula jurídica: 10 dígitos, con o sin guiones (X-XXX-XXXXXX).
export const REGEX_CEDULA_JURIDICA = /^\d-?\d{3}-?\d{6}$/;
// DIMEX (extranjeros residentes): 11 o 12 dígitos.
export const REGEX_DIMEX = /^\d{11,12}$/;
// Teléfono de Costa Rica: 8 dígitos, con o sin guion (XXXX-XXXX).
export const REGEX_TELEFONO = /^\d{4}-?\d{4}$/;
// Correo: usuario@dominio.ext, sin espacios.
export const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Fecha en formato ISO (YYYY-MM-DD).
export const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export type TipoIdentificacion = 'fisica' | 'juridica' | 'dimex';

export const MENSAJES_VALIDACION = {
  cedulaFisica: 'La cédula física debe tener 9 dígitos (ej. 1-2345-6789).',
  cedulaJuridica:
    'La cédula jurídica debe tener 10 dígitos (ej. 3-101-123456).',
  identificacion:
    'La identificación debe ser una cédula física (9 dígitos), jurídica (10 dígitos) o un DIMEX (11 o 12 dígitos).',
  telefono: 'El teléfono debe tener 8 dígitos (ej. 8888-8888).',
  correo: 'El correo electrónico no tiene un formato válido.',
  fecha: 'La fecha no es válida (formato AAAA-MM-DD).',
} as const;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function esCedulaFisica(valor: unknown): boolean {
  return REGEX_CEDULA_FISICA.test(texto(valor));
}

export function esCedulaJuridica(valor: unknown): boolean {
  return REGEX_CEDULA_JURIDICA.test(texto(valor));
}

export function esDimex(valor: unknown): boolean {
  return REGEX_DIMEX.test(texto(valor));
}

// Acepta cualquiera de los tipos indicados (por defecto los tres).
export function esIdentificacion(
  valor: unknown,
  tipos: TipoIdentificacion[] = ['fisica', 'juridica', 'dimex'],
): boolean {
  return (
    (tipos.includes('fisica') && esCedulaFisica(valor)) ||
    (tipos.includes('juridica') && esCedulaJuridica(valor)) ||
    (tipos.includes('dimex') && esDimex(valor))
  );
}

export function esTelefono(valor: unknown): boolean {
  return REGEX_TELEFONO.test(texto(valor));
}

export function esCorreo(valor: unknown): boolean {
  return REGEX_CORREO.test(texto(valor));
}

// Fecha real del calendario (rechaza 2026-02-30).
export function esFecha(valor: unknown): boolean {
  const v = texto(valor).slice(0, 10);
  if (!REGEX_FECHA.test(v)) return false;
  const fecha = new Date(`${v}T00:00:00Z`);
  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v
  );
}

// Mensaje de identificación según los tipos aceptados en cada campo.
export function mensajeIdentificacion(tipos: TipoIdentificacion[]): string {
  if (tipos.length === 1 && tipos[0] === 'fisica')
    return MENSAJES_VALIDACION.cedulaFisica;
  if (tipos.length === 1 && tipos[0] === 'juridica')
    return MENSAJES_VALIDACION.cedulaJuridica;
  return MENSAJES_VALIDACION.identificacion;
}

// Uniforma cédulas costarricenses: física (9 dígitos) como X-XXXX-XXXX y
// jurídica (10 dígitos) como X-XXX-XXXXXX. Un DIMEX se guarda solo con
// dígitos. Así una misma cédula escrita con o sin guiones se detecta como
// duplicada.
export function formatearCedula(cedula?: string | null): string | null {
  if (!cedula) return cedula ?? null;
  const digitos = cedula.replace(/\D/g, '');
  if (digitos.length === 9) {
    return `${digitos.slice(0, 1)}-${digitos.slice(1, 5)}-${digitos.slice(5)}`;
  }
  if (digitos.length === 10) {
    return `${digitos.slice(0, 1)}-${digitos.slice(1, 4)}-${digitos.slice(4)}`;
  }
  if (digitos.length === 11 || digitos.length === 12) return digitos;
  return String(cedula).trim();
}

// Uniforma teléfonos de 8 dígitos al formato XXXX-XXXX.
export function formatearTelefono(telefono?: string | null): string | null {
  if (!telefono) return telefono ?? null;
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length === 8) {
    return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  }
  return String(telefono).trim();
}

// Correo sin espacios y en minúscula, para comparar duplicados.
export function normalizarCorreo(correo?: string | null): string | null {
  if (!correo) return correo ?? null;
  return correo.trim().toLowerCase();
}
