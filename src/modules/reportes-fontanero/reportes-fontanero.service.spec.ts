import { BadRequestException } from '@nestjs/common';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { TipoActividad } from './entities/reporte-fontanero.enums';

// Pruebas del registro de actividad del fontanero. Lo más delicado es el
// descuento de materiales: tiene que ser atómico (o se descuentan todos o
// ninguno) y nunca dejar el inventario en negativo.

describe('ReportesFontaneroService', () => {
  let service: ReportesFontaneroService;
  let reportes: any[];
  let materiales: any[];
  let stock: Map<number, { id: number; nombre: string; cantidad: number }>;
  let inventarioService: { descontarMaterialEnTransaccion: jest.Mock };
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

  // "Transacción" simulada: guarda los cambios en arreglos y, si el callback
  // lanza, los revierte — igual que haría MySQL con un ROLLBACK.
  function dataSourceFalso() {
    return {
      transaction: async (fn: (m: any) => Promise<any>) => {
        const reportesAntes = [...reportes];
        const materialesAntes = [...materiales];
        const stockAntes = new Map(
          [...stock].map(([k, v]) => [k, { ...v }]),
        );
        try {
          return await fn(managerFalso());
        } catch (error) {
          reportes = reportesAntes;
          materiales = materialesAntes;
          stock = stockAntes;
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
        if ('tipo_actividad' in fila) reportes.push(fila);
        else materiales.push(fila);
        return Promise.resolve(fila);
      },
    };
  }

  beforeEach(() => {
    reportes = [];
    materiales = [];
    stock = new Map([
      [1, { id: 1, nombre: 'Tubo PVC 1/2', cantidad: 10 }],
      [2, { id: 2, nombre: 'Codo PVC', cantidad: 3 }],
    ]);

    // Simula el descuento real: valida stock y lo baja, como hace el
    // servicio de inventario.
    inventarioService = {
      descontarMaterialEnTransaccion: jest.fn((_manager: any, params: any) => {
        const articulo = stock.get(params.articuloId);
        if (!articulo) {
          return Promise.reject(new BadRequestException('material inexistente'));
        }
        if (articulo.cantidad < params.cantidad) {
          return Promise.reject(
            new BadRequestException(
              `No hay suficiente "${articulo.nombre}": disponibles ${articulo.cantidad}, solicitados ${params.cantidad}`,
            ),
          );
        }
        articulo.cantidad -= params.cantidad;
        return Promise.resolve({ articulo: { ...articulo } });
      }),
    };

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
      {} as any,
      empleadoRepository as any,
      { findOneBy: jest.fn(() => Promise.resolve({ id: 9, email: 'luis@asada.test' })) } as any,
      inventarioService as any,
      bitacoraService as any,
      dataSourceFalso(),
    );
  });

  it('guarda el reporte a nombre del fontanero autenticado, no del formulario', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(reportes).toHaveLength(1);
    expect(reportes[0].empleado_id).toBe(4);
    expect(reportes[0].tiempo_minutos).toBe(120);
  });

  it('rechaza el reporte si la cuenta no está vinculada a un empleado', async () => {
    await expect(
      service.crear(dtoBase as any, { id: 99, role: 'fontanero' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(reportes).toHaveLength(0);
  });

  it('descuenta del inventario cada material utilizado', async () => {
    await service.crear(
      { ...dtoBase, materiales: [{ articuloId: 1, cantidad: 4 }] } as any,
      usuarioFontanero,
    );

    expect(stock.get(1)!.cantidad).toBe(6);
    expect(materiales).toHaveLength(1);
    expect(materiales[0].nombre_articulo).toBe('Tubo PVC 1/2');
  });

  it('suma las cantidades si el mismo material aparece dos veces', async () => {
    // El formulario permite agregar filas y es fácil elegir el mismo
    // material dos veces; si no se agruparan, se validaría el stock por
    // separado y podría pasar una cantidad total mayor a la disponible.
    // Total 4 sobre 3 disponibles: debe fallar como una sola petición de 4,
    // en vez de descontar 2 y 2 por separado (que sí pasarían la validación
    // una por una y dejarían el stock en -1).
    await expect(
      service.crear(
        {
          ...dtoBase,
          materiales: [
            { articuloId: 2, cantidad: 2 },
            { articuloId: 2, cantidad: 2 },
          ],
        } as any,
        usuarioFontanero,
      ),
    ).rejects.toThrow(/No hay suficiente/);

    expect(inventarioService.descontarMaterialEnTransaccion).toHaveBeenCalledTimes(1);
    expect(stock.get(2)!.cantidad).toBe(3);
  });

  it('no guarda nada si falta stock de alguno de los materiales', async () => {
    await expect(
      service.crear(
        {
          ...dtoBase,
          materiales: [
            { articuloId: 1, cantidad: 2 }, // hay de sobra
            { articuloId: 2, cantidad: 50 }, // no alcanza
          ],
        } as any,
        usuarioFontanero,
      ),
    ).rejects.toThrow(/No hay suficiente/);

    // Lo importante: el primer material tampoco quedó descontado y no se
    // guardó ni el reporte ni sus materiales.
    expect(stock.get(1)!.cantidad).toBe(10);
    expect(reportes).toHaveLength(0);
    expect(materiales).toHaveLength(0);
  });

  it('permite un reporte sin materiales (no todo trabajo consume inventario)', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(reportes).toHaveLength(1);
    expect(inventarioService.descontarMaterialEnTransaccion).not.toHaveBeenCalled();
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
