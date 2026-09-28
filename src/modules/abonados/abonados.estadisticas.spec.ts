import { BadRequestException } from '@nestjs/common';
import { AbonadosService } from './abonados.service';
import { AbonadosController } from './abonados.controller';
import { Abonado } from './entities/abonado.entity';
import { FiltroEstadisticasAbonadosDto } from './dto/filtro-estadisticas-abonados.dto';

describe('Abonados Estadísticas (PBI reportes)', () => {
  let service: AbonadosService;
  let controller: AbonadosController;

  let abonadoRepository: any;
  let historialRepository: any;
  let userRepository: any;
  let empleadoRepository: any;
  let solicitudRepository: any;
  let averiaRepository: any;
  let authService: any;
  let bitacoraService: any;

  let queryBuilderMock: any;

  const mockAbonados: Abonado[] = [
    {
      id: 1,
      numero_abonado: 'AB-2026-0001',
      tipo_abonado: 'Física',
      nombre: 'Juan',
      cedula: '1-1111-2222',
      telefono: '8888-1111',
      correo: 'juan@email.com',
      direccion: 'Pueblo Nuevo',
      estado: 'Activo',
      fecha_registro: new Date('2026-01-15T10:00:00'),
      fisico: {
        apellido1: 'Pérez',
        apellido2: 'Mora',
        numero_plano_catastrado: null,
      } as any,
      juridico: null,
      usuario: null,
    } as Abonado,
    {
      id: 2,
      numero_abonado: 'AB-2026-0002',
      tipo_abonado: 'Jurídica',
      nombre: 'ASADA Pueblo Nuevo',
      cedula: '3-101-456789',
      telefono: '8888-2222',
      correo: 'asada@email.com',
      direccion: 'Centro',
      estado: 'Inactivo',
      fecha_registro: new Date('2026-02-20T09:00:00'),
      fisico: null,
      juridico: {
        nombre_representante_legal: 'María',
        cedula_representante: '1-2222-3333',
      } as any,
      usuario: null,
    } as Abonado,
  ];

  beforeEach(() => {
    queryBuilderMock = {
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
      getRawMany: jest.fn().mockResolvedValue([
        { tipo: 'Física', total: '1' },
        { tipo: 'Jurídica', total: '1' },
      ]),
      getMany: jest.fn().mockResolvedValue(mockAbonados),
    };

    abonadoRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    historialRepository = { find: jest.fn(), save: jest.fn() };
    userRepository = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    empleadoRepository = { findOneBy: jest.fn() };
    solicitudRepository = { findOne: jest.fn(), count: jest.fn() };
    averiaRepository = { findOne: jest.fn(), count: jest.fn() };
    authService = {};
    bitacoraService = {
      registrar: jest.fn(),
      registrarCreacion: jest.fn(),
      registrarCambioEstado: jest.fn(),
      historialDeRegistro: jest.fn().mockResolvedValue([]),
    };

    service = new AbonadosService(
      abonadoRepository,
      historialRepository,
      userRepository,
      empleadoRepository,
      solicitudRepository,
      averiaRepository,
      authService,
      bitacoraService,
    );

    controller = new AbonadosController(service);
  });

  describe('AbonadosService.obtenerEstadisticas', () => {
    it('1. Consulta con rango de fechas válido retorna estadísticas agrupadas y registros planos', async () => {
      const filtros: FiltroEstadisticasAbonadosDto = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
      };

      queryBuilderMock.getCount.mockResolvedValueOnce(2);
      queryBuilderMock.getRawMany
        .mockResolvedValueOnce([
          { tipo: 'Física', total: '1' },
          { tipo: 'Jurídica', total: '1' },
        ])
        .mockResolvedValueOnce([
          { estado: 'Activo', total: '1' },
          { estado: 'Inactivo', total: '1' },
        ]);
      queryBuilderMock.getMany.mockResolvedValueOnce(mockAbonados);

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado).toBeDefined();
      expect(resultado.total).toBe(2);
      expect(resultado.porTipo).toEqual([
        { tipo: 'Física', total: 1 },
        { tipo: 'Jurídica', total: 1 },
      ]);
      expect(resultado.porEstado).toEqual([
        { estado: 'Activo', total: 1 },
        { estado: 'Inactivo', total: 1 },
      ]);
      expect(resultado.registros).toHaveLength(2);
      expect(resultado.registros[0].apellido1).toBe('Pérez');
      expect(resultado.registros[1].nombre_representante_legal).toBe('María');

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'a.fecha_registro >= :inicio',
        { inicio: '2026-01-01 00:00:00' },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'a.fecha_registro <= :fin',
        { fin: '2026-12-31 23:59:59' },
      );
    });

    it('2. Consulta con filtros combinados por tipo y por estado aplica condiciones en SQL', async () => {
      const filtros: FiltroEstadisticasAbonadosDto = {
        tipo: 'Física',
        estado: 'Activo',
      };

      queryBuilderMock.getCount.mockResolvedValueOnce(1);
      queryBuilderMock.getRawMany
        .mockResolvedValueOnce([{ tipo: 'Física', total: '1' }])
        .mockResolvedValueOnce([{ estado: 'Activo', total: '1' }]);
      queryBuilderMock.getMany.mockResolvedValueOnce([mockAbonados[0]]);

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado.total).toBe(1);
      expect(resultado.porTipo).toEqual([{ tipo: 'Física', total: 1 }]);
      expect(resultado.porEstado).toEqual([{ estado: 'Activo', total: 1 }]);
      expect(resultado.registros[0].nombre).toBe('Juan');

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'a.tipo_abonado = :tipo',
        { tipo: 'Física' },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'a.estado = :estado',
        { estado: 'Activo' },
      );
    });

    it('3. Validación de rango de fechas incoherente arroja BadRequestException', async () => {
      const filtrosIncoherentes: FiltroEstadisticasAbonadosDto = {
        fechaInicio: '2026-02-15',
        fechaFin: '2026-02-01',
      };

      await expect(
        service.obtenerEstadisticas(filtrosIncoherentes),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.obtenerEstadisticas(filtrosIncoherentes),
      ).rejects.toThrow(
        'La fecha de inicio no puede ser posterior a la fecha de fin',
      );
    });

    it('4. Consulta sin resultados retorna totales en 0 y arreglos vacíos sin error 500', async () => {
      const filtros: FiltroEstadisticasAbonadosDto = {
        tipo: 'Tipo Inexistente',
      };

      queryBuilderMock.getCount.mockResolvedValueOnce(0);

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado).toEqual({
        total: 0,
        porTipo: [],
        porEstado: [],
        registros: [],
      });
      expect(queryBuilderMock.getRawMany).not.toHaveBeenCalled();
      expect(queryBuilderMock.getMany).not.toHaveBeenCalled();
    });
  });

  describe('AbonadosController.obtenerEstadisticas', () => {
    it('debe invocar al servicio con los filtros correspondientes', async () => {
      const filtros: FiltroEstadisticasAbonadosDto = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
      };

      const spy = jest
        .spyOn(service, 'obtenerEstadisticas')
        .mockResolvedValueOnce({
          total: 0,
          porTipo: [],
          porEstado: [],
          registros: [],
        });

      const res = await controller.obtenerEstadisticas(filtros);

      expect(spy).toHaveBeenCalledWith(filtros);
      expect(res).toEqual({
        total: 0,
        porTipo: [],
        porEstado: [],
        registros: [],
      });
    });
  });
});
