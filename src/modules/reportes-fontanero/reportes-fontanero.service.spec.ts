import { BadRequestException } from '@nestjs/common';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { TipoActividad } from './entities/reporte-fontanero.enums';

// Pruebas del registro de actividad del fontanero. Los materiales van en
// texto libre dentro del reporte (sin descuento de inventario), así que la
// transacción solo guarda el reporte en sí.

describe('ReportesFontaneroService', () => {
  let service: ReportesFontaneroService;
  let reportes: any[];
  let bitacoraService: { registrarCreacion: jest.Mock };
  let empleadoRepository: any;

  const fontanero = { id: 4, nombre: 'Luis Fontanero', usuario: { id: 9 } };
  const usuarioFontanero = { id: 9, role: 'fontanero' } as any;

  const dtoBase = {
    tipoActividad: TipoActividad.REPARACION,
    descripcion: 'Cambio de tubería en el sector norte',
    fechaTrabajo: '2026-09-20',
    tiempoMinutos: 120,
  };

  // "Transacción" simulada: guarda los cambios en un arreglo y, si el
  // callback lanza, los revierte — igual que haría MySQL con un ROLLBACK.
  function dataSourceFalso() {
    return {
      transaction: async (fn: (m: any) => Promise<any>) => {
        const reportesAntes = [...reportes];
        try {
          return await fn(managerFalso());
        } catch (error) {
          reportes = reportesAntes;
          throw error;
        }
      },
    } as any;
  }

  function managerFalso() {
    let siguienteId = 1;
    return {
      create: (_entidad: unknown, datos: any) => ({ ...datos }),
      save: (_entidad: any, fila: any) => {
        if (fila.id === undefined) fila.id = siguienteId++;
        reportes.push(fila);
        return Promise.resolve(fila);
      },
    };
  }

  beforeEach(() => {
    reportes = [];

    bitacoraService = { registrarCreacion: jest.fn(() => Promise.resolve()) };

    empleadoRepository = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(where?.usuario?.id === 9 ? fontanero : null),
      ),
    };

    const reporteRepository = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(reportes.find((r) => r.id === where.id) ?? null),
      ),
      find: jest.fn(() => Promise.resolve(reportes)),
      findAndCount: jest.fn(() => Promise.resolve([reportes, reportes.length])),
    };

    service = new ReportesFontaneroService(
      reporteRepository as any,
      empleadoRepository as any,
      { findOneBy: jest.fn(() => Promise.resolve({ id: 9, email: 'luis@asada.test' })) } as any,
      bitacoraService as any,
      dataSourceFalso(),
    );
  });

  it('guarda el reporte a nombre del fontanero autenticado, no del formulario', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(reportes).toHaveLength(1);
    expect(reportes[0].empleado_id).toBe(4);
    expect(reportes[0].tiempo_minutos).toBe(120);
    expect(reportes[0].materiales_texto).toBeNull();
  });

  it('rechaza el reporte si la cuenta no está vinculada a un empleado', async () => {
    await expect(
      service.crear(dtoBase as any, { id: 99, role: 'fontanero' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(reportes).toHaveLength(0);
  });

  it('guarda los materiales en texto libre recortados', async () => {
    await service.crear(
      {
        ...dtoBase,
        materialesTexto: '  2 m de tubo PVC, 1 codo, 3 m de cable  ',
      } as any,
      usuarioFontanero,
    );

    expect(reportes).toHaveLength(1);
    expect(reportes[0].materiales_texto).toBe('2 m de tubo PVC, 1 codo, 3 m de cable');
  });

  it('permite un reporte sin materiales (no todo trabajo consume material)', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(reportes).toHaveLength(1);
    expect(reportes[0].materiales_texto).toBeNull();
  });

  it('deja el movimiento auditado en la bitácora', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
      'reportes_fontanero',
      expect.any(Number),
      { id: 9, email: 'luis@asada.test' },
      expect.stringContaining('Luis Fontanero'),
    );
  });

  describe('buscar', () => {
    it('devuelve una lista vacía (no un error) cuando no hay coincidencias', async () => {
      const r = await service.buscar({ empleadoId: 999 });
      expect(r.datos).toEqual([]);
      expect(r.total).toBe(0);
    });

    it('nunca devuelve más de 100 filas por página aunque se pidan más', async () => {
      const r = await service.buscar({ limite: 5000 });
      expect(r.limite).toBe(100);
    });
  });
});