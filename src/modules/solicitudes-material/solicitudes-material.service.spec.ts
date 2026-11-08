import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SolicitudesMaterialService } from './solicitudes-material.service';
import { CrearSolicitudMaterialDto } from './dto/crear-solicitud-material.dto';

// Pruebas del flujo de solicitudes de material: creación (trabajo propio, una
// pendiente por trabajo, ítems libres), aprobación (materiales sin vincular,
// stock insuficiente y descuento correcto), rechazo, catálogo y el chequeo que
// usa averías/labores para bloquear el inicio.

function articulo(id: number, extra: Record<string, any> = {}) {
  return {
    id,
    nombre: `Material ${id}`,
    clasificacion: 'materiales',
    cantidad_disponible: 10,
    ubicacion: 'Bodega',
    estado: 'activo',
    ...extra,
  };
}

function detalle(id: number, extra: Record<string, any> = {}) {
  return {
    id,
    cantidad: 2,
    articulo: articulo(1),
    id_articulo: 1,
    descripcion_libre: null,
    unidad: null,
    ...extra,
  };
}

function solicitud(extra: Record<string, any> = {}) {
  return {
    id: 50,
    codigo_solicitud_material: 'SM-2026-1111',
    estado: 'Pendiente',
    motivo: 'Se necesita para reparar la fuga',
    motivo_rechazo: null,
    empleado: { id: 3, nombre: 'Fontanero Uno' },
    averia: { id: 10, codigo_averia: 'AVE-2026-1234', estado: 'Pendiente' },
    labor: null,
    detalles: [detalle(1)],
    ...extra,
  } as any;
}

describe('SolicitudesMaterialService', () => {
  let service: SolicitudesMaterialService;
  let solicitudes: any;
  let detalles: any;
  let empleados: any;
  let averias: any;
  let labores: any;
  let articulos: any;
  let usuarios: any;
  let inventarioService: any;
  let bitacoraService: any;
  let dataSource: any;

  const fontanero = { id: 3, role: 'fontanero' } as any;
  const admin = { id: 7, role: 'admin' } as any;
  const empleado = { id: 3, nombre: 'Fontanero Uno' };

  beforeEach(() => {
    solicitudes = {
      findOne: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((datos: any) => ({ ...datos })),
      save: jest.fn((fila: any) => Promise.resolve({ id: 50, ...fila })),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    detalles = {
      create: jest.fn((datos: any) => ({ ...datos })),
      save: jest.fn((filas: any) => Promise.resolve(filas)),
    };
    empleados = { findOne: jest.fn().mockResolvedValue(empleado) };
    averias = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        codigo_averia: 'AVE-2026-1234',
        estado: 'Pendiente',
        empleado: { id: 3 },
      }),
    };
    labores = { findOne: jest.fn() };
    articulos = {
      findOneBy: jest.fn(({ id }: any) =>
        Promise.resolve(articulo(id, { cantidad_disponible: 10 })),
      ),
      find: jest.fn().mockResolvedValue([articulo(1), articulo(2)]),
    };
    usuarios = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 7,
        email: 'admin@asada.test',
        username: 'Admin',
      }),
    };
    inventarioService = {
      descontarMaterialEnTransaccion: jest.fn().mockResolvedValue({}),
    };
    bitacoraService = {
      registrarCreacion: jest.fn().mockResolvedValue(undefined),
      registrarCambioEstado: jest.fn().mockResolvedValue(undefined),
      registrar: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(async (cb: any) =>
        cb({ save: jest.fn().mockResolvedValue(undefined) }),
      ),
    };

    service = new SolicitudesMaterialService(
      solicitudes,
      detalles,
      empleados,
      averias,
      labores,
      articulos,
      usuarios,
      inventarioService,
      bitacoraService,
      dataSource,
    );
  });

  describe('crear', () => {
    const dtoBase: CrearSolicitudMaterialDto = {
      averiaId: 10,
      motivo: 'Se necesita para reparar la fuga',
      items: [{ articuloId: 1, cantidad: 2 }],
    };

    it('crea la solicitud pendiente con sus ítems', async () => {
      solicitudes.findOne
        .mockResolvedValueOnce(null) // no hay pendiente duplicada
        .mockResolvedValueOnce(solicitud()); // findOne final

      const resultado = await service.crear(dtoBase, fontanero);

      expect(resultado.codigo_solicitud_material).toMatch(/^SM-\d{4}-\d{4}$/);
      expect(solicitudes.save).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'Pendiente',
          id_averia: 10,
          id_labor: null,
        }),
      );
      expect(detalles.save).toHaveBeenCalled();
      expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
        'solicitudes_material',
        50,
        expect.anything(),
        expect.stringContaining('AVE-2026-1234'),
      );
    });

    it('acepta materiales escritos a mano ("Otro") sin artículo', async () => {
      solicitudes.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(solicitud());

      await service.crear(
        {
          ...dtoBase,
          items: [
            {
              descripcionLibre: 'manguera de 1 pulgada',
              unidad: 'metros',
              cantidad: 3,
            },
          ],
        },
        fontanero,
      );

      expect(detalles.create).toHaveBeenCalledWith(
        expect.objectContaining({
          articulo: null,
          descripcion_libre: 'manguera de 1 pulgada',
          unidad: 'metros',
          cantidad: 3,
        }),
      );
    });

    it('no permite dos solicitudes pendientes para el mismo trabajo', async () => {
      solicitudes.findOne.mockResolvedValueOnce({
        codigo_solicitud_material: 'SM-2026-9999',
      });

      await expect(service.crear(dtoBase, fontanero)).rejects.toThrow(
        BadRequestException,
      );
      expect(solicitudes.save).not.toHaveBeenCalled();
    });

    it('rechaza una avería que no está asignada al fontanero', async () => {
      averias.findOne.mockResolvedValueOnce({
        id: 10,
        estado: 'Pendiente',
        empleado: { id: 99 },
      });

      await expect(service.crear(dtoBase, fontanero)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza un ítem sin artículo y sin descripción', async () => {
      await expect(
        service.crear(
          { ...dtoBase, items: [{ cantidad: 1 } as any] },
          fontanero,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('aprobar', () => {
    it('no aprueba con materiales libres sin vincular', async () => {
      solicitudes.findOne.mockResolvedValue(
        solicitud({
          detalles: [
            detalle(1, { articulo: null, descripcion_libre: 'manguera' }),
          ],
        }),
      );

      await expect(service.aprobar(50, admin)).rejects.toThrow(
        /vinculá al inventario/i,
      );
      expect(inventarioService.descontarMaterialEnTransaccion).not.toHaveBeenCalled();
    });

    it('no descuenta nada si falta stock', async () => {
      solicitudes.findOne.mockResolvedValue(
        solicitud({
          detalles: [
            detalle(1, {
              cantidad: 5,
              articulo: articulo(1, { cantidad_disponible: 2 }),
            }),
          ],
        }),
      );

      await expect(service.aprobar(50, admin)).rejects.toThrow(
        /No hay stock suficiente/i,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('aprueba, descuenta el stock y deja la solicitud con su revisor', async () => {
      const pendiente = solicitud();
      solicitudes.findOne.mockResolvedValue(pendiente);

      const resultado = await service.aprobar(50, admin);

      expect(inventarioService.descontarMaterialEnTransaccion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          articuloId: 1,
          cantidad: 2,
          responsable: 'Fontanero Uno',
        }),
      );
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(resultado.estado).toBe('Aprobada');
      expect(resultado.revisado_por).toBeTruthy();
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        'solicitudes_material',
        50,
        expect.anything(),
        'Pendiente',
        'Aprobada',
        expect.any(String),
      );
    });
  });

  describe('rechazar', () => {
    it('guarda el motivo y deja la solicitud rechazada', async () => {
      const pendiente = solicitud();
      solicitudes.findOne.mockResolvedValue(pendiente);

      const resultado = await service.rechazar(
        50,
        { motivoRechazo: 'No hay presupuesto este mes' },
        admin,
      );

      expect(resultado.estado).toBe('Rechazada');
      expect(resultado.motivo_rechazo).toBe('No hay presupuesto este mes');
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        'solicitudes_material',
        50,
        expect.anything(),
        'Pendiente',
        'Rechazada',
        'No hay presupuesto este mes',
      );
    });
  });

  describe('catálogo y bloqueo', () => {
    it('el catálogo solo devuelve los campos necesarios', async () => {
      const catalogo = await service.catalogo();

      expect(catalogo[0]).toEqual({
        id: 1,
        nombre: 'Material 1',
        clasificacion: 'materiales',
        cantidad_disponible: 10,
        ubicacion: 'Bodega',
      });
    });

    it('tienePendiente consulta por el trabajo y el estado', async () => {
      solicitudes.findOne.mockResolvedValueOnce({ id: 50 });
      expect(await service.tienePendiente(10, null)).toBe(true);
      expect(solicitudes.findOne).toHaveBeenCalledWith({
        where: { estado: 'Pendiente', averia: { id: 10 } },
      });

      solicitudes.findOne.mockResolvedValueOnce(null);
      expect(await service.tienePendiente(null, 4)).toBe(false);
    });
  });
});
