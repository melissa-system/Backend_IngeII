import { BadRequestException } from '@nestjs/common';
import { AveriasService } from './averias.service';

// Regla: al asignar un fontanero, la avería pasa sola a "En proceso" (el
// fontanero la sigue viendo "Pendiente" hasta que inicia la gestión) y ese
// estado no se puede fijar a mano desde la administración.

describe('AveriasService.actualizar — asignación de fontanero', () => {
  let service: AveriasService;
  let averias: any;
  let historial: any;
  let empleados: any;
  let bitacora: any;

  function averiaBase() {
    return {
      id: 1,
      codigo_averia: 'AVE-2026-1234',
      tipo_averia: 'Fuga de agua',
      descripcion: 'Fuga frente a la escuela',
      estado: 'Pendiente',
      empleado: null,
      gestion_iniciada_en: null,
      gestion_finalizada_en: null,
      devuelta_revision: false,
      motivo_revision: null,
      fecha_reporte: new Date('2026-10-01T10:00:00Z'),
    };
  }

  beforeEach(() => {
    averias = {
      findOne: jest.fn(),
      save: jest.fn((averia: any) => Promise.resolve(averia)),
    };
    historial = { find: jest.fn().mockResolvedValue([]) };
    empleados = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 5, nombre: 'Juan', apellido1: 'Mora' }),
    };
    bitacora = {
      registrar: jest.fn().mockResolvedValue(undefined),
      registrarCambioEstado: jest.fn().mockResolvedValue(undefined),
      historialDeRegistro: jest.fn().mockResolvedValue([]),
    };

    service = new AveriasService(
      averias,
      historial,
      empleados,
      {} as any,
      {} as any,
      bitacora,
      { tienePendiente: jest.fn().mockResolvedValue(false) } as any,
    );
  });

  it('al asignar un fontanero pasa a "En proceso" y lo registra en la bitácora', async () => {
    const averia = averiaBase();
    averias.findOne.mockResolvedValue(averia);

    const resultado = await service.actualizar(
      1,
      { empleado_id: 5, realizado_por: 'Admin' },
      7,
    );

    expect(resultado.estado).toBe('En proceso');
    expect(bitacora.registrarCambioEstado).toHaveBeenCalledWith(
      'averias',
      1,
      expect.anything(),
      'Pendiente',
      'En proceso',
      expect.stringContaining('Asignación'),
    );
    expect(averias.save).toHaveBeenCalled();
  });

  it('no permite fijar "En proceso" a mano', async () => {
    averias.findOne.mockResolvedValue(averiaBase());

    await expect(
      service.actualizar(1, { estado: 'En proceso' }, 7),
    ).rejects.toThrow(BadRequestException);
    expect(averias.save).not.toHaveBeenCalled();
  });

  it('respeta un "Finalizado" enviado junto con la asignación', async () => {
    averias.findOne.mockResolvedValue(averiaBase());

    const resultado = await service.actualizar(
      1,
      { empleado_id: 5, estado: 'Finalizado' },
      7,
    );

    expect(resultado.estado).toBe('Finalizado');
  });
});
