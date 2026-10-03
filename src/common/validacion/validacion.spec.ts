import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  esCorreo,
  esFecha,
  esIdentificacion,
  esTelefono,
  formatearCedula,
  formatearTelefono,
} from './reglas-validacion';
import { CreateAbonadoDto } from '../../modules/abonados/dto/create-abonado.dto';
import { CrearEmpleadoDto } from '../../modules/empleados/dto/empleado.dto';
import { CrearProveedorDto } from '../../modules/inventario/dto/crear-proveedor.dto';
import { CreateAveriaDto } from '../../modules/averias/dto/create-averia.dto';
import { CrearSolicitudCambioPropietarioDto } from '../../modules/solicitudes/cambio-propietario/dto/crear-solicitud-cambio-propietario.dto';

// PBI 511 / Task 514: las reglas comunes y los DTOs rechazan datos inválidos
// aunque la petición no pase por el formulario del frontend.

async function camposConError(
  clase: new () => object,
  datos: Record<string, unknown>,
): Promise<string[]> {
  const errores = await validate(plainToInstance(clase, datos));
  return errores.map((e) => e.property).sort();
}

describe('Reglas de validación comunes (PBI 511 / Task 514)', () => {
  it('acepta cédulas físicas, jurídicas y DIMEX con o sin guiones', () => {
    expect(esIdentificacion('1-2345-6789')).toBe(true);
    expect(esIdentificacion('123456789')).toBe(true);
    expect(esIdentificacion('3-101-123456')).toBe(true);
    expect(esIdentificacion('3101123456')).toBe(true);
    expect(esIdentificacion('123456789012')).toBe(true);
  });

  it('rechaza cédulas incompletas, con letras o del tipo equivocado', () => {
    expect(esIdentificacion('1-2345-678')).toBe(false);
    expect(esIdentificacion('12345678A')).toBe(false);
    expect(esIdentificacion('')).toBe(false);
    expect(esIdentificacion(undefined)).toBe(false);
    expect(esIdentificacion('3-101-123456', ['fisica'])).toBe(false);
    expect(esIdentificacion('1-2345-6789', ['juridica'])).toBe(false);
  });

  it('valida teléfono de 8 dígitos, correo y fecha real', () => {
    expect(esTelefono('8888-8888')).toBe(true);
    expect(esTelefono('88888888')).toBe(true);
    expect(esTelefono('8888-888')).toBe(false);
    expect(esTelefono('+506 8888 8888')).toBe(false);
    expect(esCorreo('ana@correo.com')).toBe(true);
    expect(esCorreo('ana@correo')).toBe(false);
    expect(esCorreo('ana correo@x.com')).toBe(false);
    expect(esFecha('2026-02-28')).toBe(true);
    expect(esFecha('2026-02-30')).toBe(false);
    expect(esFecha('28/02/2026')).toBe(false);
  });

  it('uniforma cédula y teléfono para detectar duplicados', () => {
    expect(formatearCedula('123456789')).toBe('1-2345-6789');
    expect(formatearCedula('3101123456')).toBe('3-101-123456');
    expect(formatearCedula('1-2345-6789')).toBe('1-2345-6789');
    expect(formatearTelefono('88887777')).toBe('8888-7777');
  });
});

describe('DTOs validan por su cuenta (sin depender del frontend)', () => {
  it('abonado: rechaza datos vacíos y formatos inválidos', async () => {
    expect(await camposConError(CreateAbonadoDto, {})).toEqual([
      'cedula',
      'correo',
      'direccion',
      'nombre',
      'telefono',
      'tipo_abonado',
    ]);
    expect(
      await camposConError(CreateAbonadoDto, {
        tipo_abonado: 'Física',
        nombre: 'Ana',
        cedula: '1-234',
        telefono: '123',
        correo: 'sin-arroba',
        direccion: 'Pueblo Nuevo',
      }),
    ).toEqual(['cedula', 'correo', 'telefono']);
  });

  it('abonado: acepta un registro válido', async () => {
    expect(
      await camposConError(CreateAbonadoDto, {
        tipo_abonado: 'Física',
        nombre: 'Ana',
        cedula: '1-2345-6789',
        telefono: '8888-8888',
        correo: 'ana@correo.com',
        direccion: 'Pueblo Nuevo',
      }),
    ).toEqual([]);
  });

  it('empleado: exige campos obligatorios y fecha válida', async () => {
    expect(await camposConError(CrearEmpleadoDto, {})).toEqual([
      'cedula',
      'fecha_ingreso',
      'nombre',
      'puesto',
      'telefono',
    ]);
    expect(
      await camposConError(CrearEmpleadoDto, {
        nombre: 'Carlos',
        cedula: '1-1111-1111',
        puesto: 'Fontanero',
        telefono: '8888-1111',
        fecha_ingreso: '2026-13-40',
      }),
    ).toEqual(['fecha_ingreso']);
  });

  it('proveedor: los opcionales vacíos pasan, con valor inválido no', async () => {
    expect(
      await camposConError(CrearProveedorDto, {
        nombre: 'Ferretería',
        telefono: '',
        correo: '',
      }),
    ).toEqual([]);
    expect(
      await camposConError(CrearProveedorDto, {
        nombre: 'Ferretería',
        telefono: '12',
        correo: 'x@',
      }),
    ).toEqual(['correo', 'telefono']);
  });

  it('avería pública: rechaza tipo inventado, cédula inválida y textos largos', async () => {
    expect(
      await camposConError(CreateAveriaDto, {
        tipo_averia: 'Inventado',
        descripcion: 'Fuga grande frente a la escuela',
        cedula_reportante: 'DIMEX 123',
        nombre_reportante: 'x'.repeat(101),
      }),
    ).toEqual(['cedula_reportante', 'nombre_reportante', 'tipo_averia']);
  });

  it('cambio de propietario: valida cédula y teléfono del nuevo propietario', async () => {
    expect(
      await camposConError(CrearSolicitudCambioPropietarioDto, {
        nombreNuevoPropietario: 'María Rojas',
        cedulaNuevoPropietario: '1-2345',
        telefonoNuevoPropietario: '8888',
        correoNuevoPropietario: 'maria@correo.com',
        motivoTraspaso: 'Compraventa',
        justificacion: 'Venta de la propiedad',
      }),
    ).toEqual(['cedulaNuevoPropietario', 'telefonoNuevoPropietario']);
  });
});
