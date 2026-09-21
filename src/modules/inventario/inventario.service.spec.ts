import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { Articulo } from './entities/articulo.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { User } from '../auth/entities/user.entity';
import { ModuloBitacora, AccionBitacora } from '../bitacora/entities/bitacora.enums';

describe('InventarioService', () => {
  let service: InventarioService;

  let articuloRepository: any;
  let movimientoRepository: any;
  let proveedorRepository: any;
  let userRepository: any;
  let bitacoraService: any;
  let dataSource: any;

  let articulos: any[];
  let movimientos: any[];
  let proveedores: any[];

  const usuarioAdminPeticion = { id: 1, role: 'admin' } as any;

  beforeEach(() => {
    proveedores = [
      {
        id: 1,
        nombre: 'Distribuidora Ferretera CR',
        tipo: 'Jurídico',
        estado: 'Activo',
      },
    ];

    articulos = [
      {
        id: 1,
        nombre: 'Tubería PVC 1/2"',
        descripcion: 'Tubo de PVC para agua potable',
        clasificacion: 'articulo',
        cantidad_disponible: 50,
        fecha_ingreso: '2026-09-01',
        ubicacion: 'Bodega A',
        persona_recibe: 'Juan Pérez',
        estado: 'activo',
        proveedor: proveedores[0],
        movimientos: [],
      },
      {
        id: 2,
        nombre: 'Bomba Sumergible',
        descripcion: 'Bomba para pozo 2HP',
        clasificacion: 'inmueble',
        cantidad_disponible: 0,
        fecha_ingreso: '2026-09-02',
        ubicacion: 'Pozo 1',
        persona_recibe: 'Carlos Fontanero',
        estado: 'inactivo',
        proveedor: proveedores[0],
        movimientos: [],
      },
    ];

    movimientos = [];

    articuloRepository = {
      create: jest.fn((datos: any) => ({ id: articulos.length + 1, ...datos })),
      save: jest.fn((fila: any) => {
        const idx = articulos.findIndex((a) => a.id === fila.id);
        if (idx >= 0) {
          articulos[idx] = { ...articulos[idx], ...fila };
          return Promise.resolve(articulos[idx]);
        }
        articulos.push(fila);
        return Promise.resolve(fila);
      }),
      findOne: jest.fn(({ where, relations } = {}) => {
        const art = articulos.find((a) => a.id === where?.id);
        return Promise.resolve(art ? { ...art } : null);
      }),
      createQueryBuilder: jest.fn(() => {
        const builder: any = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([...articulos]),
        };
        return builder;
      }),
    };

    movimientoRepository = {
      create: jest.fn((datos: any) => ({ id: movimientos.length + 1, ...datos })),
      save: jest.fn((mov: any) => {
        movimientos.push(mov);
        return Promise.resolve(mov);
      }),
      find: jest.fn(({ where, order } = {}) => {
        const filtrados = movimientos.filter((m) => m.articulo?.id === where?.articulo?.id);
        return Promise.resolve(filtrados);
      }),
      createQueryBuilder: jest.fn(() => {
        const builder: any = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([...movimientos]),
        };
        return builder;
      }),
    };

    proveedorRepository = {
      findOne: jest.fn(({ where } = {}) => {
        const prov = proveedores.find((p) => p.id === where?.id);
        return Promise.resolve(prov ? { ...prov } : null);
      }),
      find: jest.fn(() => Promise.resolve([...proveedores])),
      create: jest.fn((datos: any) => ({ id: proveedores.length + 1, ...datos })),
      save: jest.fn((p: any) => Promise.resolve(p)),
      remove: jest.fn((p: any) => Promise.resolve(p)),
    };

    userRepository = {
      findOne: jest.fn(({ where } = {}) => {
        return Promise.resolve({
          id: where.id,
          email: 'admin@siapb.cr',
          username: 'admin',
        });
      }),
    };

    bitacoraService = {
      registrar: jest.fn(() => Promise.resolve()),
      registrarCreacion: jest.fn(() => Promise.resolve()),
      registrarEdicion: jest.fn(() => Promise.resolve()),
      registrarCambioEstado: jest.fn(() => Promise.resolve()),
    };

    dataSource = {
      transaction: jest.fn(async (cb: (manager: any) => Promise<any>) => {
        const manager: any = {
          findOne: (_ent: any, opts: any) => articuloRepository.findOne(opts),
          save: (ent: any, obj: any) => {
            if (ent === Articulo) return articuloRepository.save(obj);
            if (ent === MovimientoInventario) return movimientoRepository.save(obj);
            return Promise.resolve(obj);
          },
          create: (ent: any, obj: any) => {
            if (ent === MovimientoInventario) return movimientoRepository.create(obj);
            return { ...obj };
          },
        };
        return cb(manager);
      }),
    };

    service = new InventarioService(
      articuloRepository,
      movimientoRepository,
      proveedorRepository,
      userRepository,
      bitacoraService,
      dataSource,
    );
  });

  describe('crearArticulo', () => {
    it('crea un artículo exitosamente y registra en bitácora', async () => {
      const dto: any = {
        nombre: 'Codo PVC 1/2"',
        descripcion: 'Codo de 90 grados',
        clasificacion: 'articulo',
        cantidad: 20,
        fechaIngreso: '2026-09-10',
        ubicacion: 'Bodega A',
        personaRecibe: 'Juan Pérez',
        proveedorId: 1,
      };

      const res = await service.crearArticulo(dto, usuarioAdminPeticion);

      expect(res.nombre).toBe('Codo PVC 1/2"');
      expect(res.cantidad_disponible).toBe(20);
      expect(res.estado).toBe('activo');

      // Verifica auditoría en bitácora
      expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
        ModuloBitacora.INVENTARIO,
        res.id,
        { id: 1, email: 'admin@siapb.cr' },
        expect.stringContaining('Codo PVC 1/2"'),
      );

      // Movimiento inicial de entrada registrado
      expect(movimientoRepository.save).toHaveBeenCalled();
    });

    it('arroja NotFoundException si el proveedor no existe', async () => {
      const dto: any = {
        nombre: 'Artículo X',
        descripcion: 'Desc',
        clasificacion: 'articulo',
        cantidad: 5,
        ubicacion: 'Bodega B',
        personaRecibe: 'Pedro',
        proveedorId: 999,
      };

      await expect(
        service.crearArticulo(dto, usuarioAdminPeticion),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listarArticulos y obtenerPorId', () => {
    it('retorna la lista de artículos', async () => {
      const res = await service.listarArticulos();
      expect(res).toHaveLength(2);
    });

    it('retorna un artículo por id', async () => {
      const res = await service.obtenerArticuloPorId(1);
      expect(res.id).toBe(1);
      expect(res.nombre).toBe('Tubería PVC 1/2"');
    });

    it('arroja NotFoundException si no existe el id', async () => {
      await expect(service.obtenerArticuloPorId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registrarMovimiento', () => {
    it('registra una salida exitosamente y actualiza stock y ubicación', async () => {
      const dto: any = {
        tipoMovimiento: 'salida',
        cantidad: 10,
        motivo: 'Reparación de fuga sector norte',
        responsableDestino: 'Fontanero Pedro',
      };

      const { articulo, movimiento } = await service.registrarMovimiento(
        1,
        dto,
        usuarioAdminPeticion,
      );

      expect(articulo.cantidad_disponible).toBe(40);
      expect(articulo.ubicacion).toBe('Fontanero Pedro');
      expect(movimiento.tipo_movimiento).toBe('salida');
      expect(movimiento.cantidad).toBe(10);

      // Bitácora registrada
      expect(bitacoraService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: ModuloBitacora.INVENTARIO,
          accion: AccionBitacora.EDICION,
          campo: 'cantidad_disponible',
          valor_anterior: '50',
          valor_nuevo: '40',
        }),
      );
    });

    it('rechaza una salida si la cantidad supera el stock disponible', async () => {
      const dto: any = {
        tipoMovimiento: 'salida',
        cantidad: 60,
        motivo: 'Reparación masiva',
        responsableDestino: 'Fontanero',
      };

      await expect(
        service.registrarMovimiento(1, dto, usuarioAdminPeticion),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza registrar movimiento sobre un artículo inactivo', async () => {
      const dto: any = {
        tipoMovimiento: 'entrada',
        cantidad: 5,
        motivo: 'Compra',
      };

      await expect(
        service.registrarMovimiento(2, dto, usuarioAdminPeticion),
      ).rejects.toThrow(BadRequestException);
    });

    it('registra una entrada aumentando el stock', async () => {
      const dto: any = {
        tipoMovimiento: 'entrada',
        cantidad: 25,
        motivo: 'Compra trimestral',
      };

      const { articulo } = await service.registrarMovimiento(
        1,
        dto,
        usuarioAdminPeticion,
      );

      expect(articulo.cantidad_disponible).toBe(75);
    });

    it('lista todos los movimientos con filtros aplicados', async () => {
      const res = await service.listarTodosLosMovimientos({ tipo: 'entrada', busqueda: 'Tubería' });
      expect(movimientoRepository.createQueryBuilder).toHaveBeenCalled();
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe('cambiarEstado', () => {
    it('alterna el estado de activo a inactivo y registra en bitácora', async () => {
      const res = await service.cambiarEstado(1, usuarioAdminPeticion);

      expect(res.estado).toBe('inactivo');
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        ModuloBitacora.INVENTARIO,
        1,
        { id: 1, email: 'admin@siapb.cr' },
        'activo',
        'inactivo',
        expect.stringContaining('inhabilitado'),
      );
    });
  });
});
