import { BadRequestException } from '@nestjs/common';
import { ReportesFontaneroService } from './reportes-fontanero.service';
import { TipoActividad } from './entities/reporte-fontanero.enums';
import { OrigenReporte } from './entities/reporte-fontanero.enums';

// Pruebas del registro de actividad del fontanero. Los materiales van en
// texto libre dentro del reporte (sin descuento de inventario), así que la
// transacción solo guarda el reporte en sí.

describe('ReportesFontaneroService', () => {
  let service: ReportesFontaneroService;
  let reportes: any[];
  let bitacoraService: {
    registrarCreacion: jest.Mock;
    registrarCambioEstado: jest.Mock;
  };
  let cloudinaryService: { subirArchivo: jest.Mock; eliminarArchivo: jest.Mock };
  let laboresService: { crearDesdeReporte: jest.Mock };
  let empleadoRepository: any;

  const fontanero = { id: 4, nombre: 'Luis Fontanero', usuario: { id: 9 } };
  const usuarioFontanero = { id: 9, role: 'fontanero' } as any;

  const dtoBase = {
    tipoActividad: TipoActividad.REPARACION,
    descripcion: 'Cambio de tubería en el sector norte',
    fechaTrabajo: '2026-09-20',
    tiempoMinutos: 120,
  };

  // Avería falsa (id 7) asignada al fontanero, para probar el reenvío.
  const averiaFalsa = {
    id: 7,
    estado: 'En proceso',
    empleado: { id: 4 },
    devuelta_revision: true,
    motivo_revision: 'Falta evidencia',
    gestion_finalizada_en: null,
  };

  // "Transacción" simulada: guarda los cambios en un arreglo y, si el
  // callback lanza, los revierte — igual que haría MySQL con un ROLLBACK.
  function dataSourceFalso() {
    return {
      manager: {
        findOne: jest.fn((_entidad: unknown, opts: any) =>
          Promise.resolve(opts?.where?.id === 7 ? { ...averiaFalsa } : null),
        ),
        save: jest.fn((_entidad: unknown, fila: any) => Promise.resolve(fila)),
      },
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

    bitacoraService = {
      registrarCreacion: jest.fn(() => Promise.resolve()),
      registrarCambioEstado: jest.fn(() => Promise.resolve()),
    };

    cloudinaryService = {
      subirArchivo: jest.fn(() =>
        Promise.resolve({
          url: 'https://cdn.test/evidencia.jpg',
          publicId: 'asada/reportes-fontanero/evidencia',
        }),
      ),
      eliminarArchivo: jest.fn(() => Promise.resolve()),
    };

    laboresService = {
      crearDesdeReporte: jest.fn(() =>
        Promise.resolve({ id: 50, empleado_id: 4 }),
      ),
    };

    empleadoRepository = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(where?.usuario?.id === 9 ? fontanero : null),
      ),
    };

    const reporteRepository = {
      findOne: jest.fn((opts: any) => {
        const where = opts?.where ?? {};
        if (where.id !== undefined) {
          return Promise.resolve(reportes.find((r) => r.id === where.id) ?? null);
        }
        if (where.averia_id !== undefined) {
          const coinc = reportes.filter(
            (r) =>
              r.averia_id === where.averia_id &&
              r.empleado_id === where.empleado_id,
          );
          return Promise.resolve(coinc[coinc.length - 1] ?? null);
        }
        return Promise.resolve(null);
      }),
      save: jest.fn((fila: any) => {
        if (fila.id === undefined) {
          fila.id = reportes.reduce((m, r) => Math.max(m, r.id ?? 0), 0) + 1;
        }
        const idx = reportes.findIndex((r) => r.id === fila.id);
        if (idx >= 0) reportes[idx] = fila;
        else reportes.push(fila);
        return Promise.resolve(fila);
      }),
      find: jest.fn(() => Promise.resolve(reportes)),
      findAndCount: jest.fn(() => Promise.resolve([reportes, reportes.length])),
    };

    service = new ReportesFontaneroService(
      reporteRepository as any,
      empleadoRepository as any,
      {
        findOneBy: jest.fn(() =>
          Promise.resolve({ id: 9, email: 'luis@asada.test' }),
        ),
      } as any,
      bitacoraService as any,
      dataSourceFalso(),
      cloudinaryService as any,
      laboresService as any,
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

  it('sube la evidencia opcional a Cloudinary y guarda la URL', async () => {
    await service.crear(dtoBase as any, usuarioFontanero, {
      originalname: 'foto.jpg',
      mimetype: 'image/jpeg',
    } as any);

    expect(cloudinaryService.subirArchivo).toHaveBeenCalled();
    expect(reportes[0].evidencia_url).toBe('https://cdn.test/evidencia.jpg');
    expect(reportes[0].evidencia_nombre).toBe('foto.jpg');
  });

  it('crea una labor adicional cuando el reporte es manual (sin avería ni labor)', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(laboresService.crearDesdeReporte).toHaveBeenCalled();
    expect(reportes[0].labor_id).toBe(50);
  });

  it('marca como "no asignado" el reporte manual', async () => {
    await service.crear(dtoBase as any, usuarioFontanero);

    expect(reportes[0].origen).toBe(OrigenReporte.NO_ASIGNADO);
  });

  it('marca como "asignado" el reporte vinculado a una avería', async () => {
    await service.crear(
      { ...dtoBase, averiaId: 7 } as any,
      usuarioFontanero,
    );

    expect(reportes[0].origen).toBe(OrigenReporte.ASIGNADO);
  });

  it('reenvía sobre el reporte rechazado en vez de crear uno nuevo', async () => {
    reportes.push({
      id: 1,
      empleado_id: 4,
      averia_id: 7,
      estado_revision: 'Rechazado',
      reintentos: 0,
      descripcion: 'intento anterior',
      tiempo_minutos: 10,
      evidencia_url: null,
      evidencia_public_id: null,
      evidencia_nombre: null,
    });

    await service.crear(
      {
        ...dtoBase,
        averiaId: 7,
        descripcion: 'Trabajo corregido completo',
      } as any,
      usuarioFontanero,
    );

    expect(reportes).toHaveLength(1);
    expect(reportes[0].estado_revision).toBe('Pendiente');
    expect(reportes[0].reintentos).toBe(1);
    expect(reportes[0].descripcion).toBe('Trabajo corregido completo');
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
