import { BadRequestException } from '@nestjs/common';
import { AveriasService } from './averias.service';
import { AveriasController } from './averias.controller';
import { Averia } from './entities/averia.entity';
import { FiltroEstadisticasAveriasDto } from './dto/filtro-estadisticas-averias.dto';

describe('Averías Estadísticas (PBI 336 / Task 337, 338, 340)', () => {
  let service: AveriasService;
  let controller: AveriasController;

  let averiaRepository: any;
  let historialRepository: any;
  let empleadoRepository: any;
  let abonadoRepository: any;
  let bitacoraService: any;

  let queryBuilderMock: any;

  const mockAverias: Averia[] = [
    {
      id: 1,
      codigo_averia: 'AVE-2026-1001',
      tipo_averia: 'Fuga de agua',
      descripcion: 'Fuga en acera principal',
      estado: 'Pendiente',
      cedula_reportante: '101110222',
      nombre_reportante: 'Juan',
      apellido1_reportante: 'Pérez',
      apellido2_reportante: 'Mora',
      fecha_reporte: new Date('2026-01-15T10:00:00.000Z'),
      empleado: null,
      historial: [],
    },
    {
      id: 2,
      codigo_averia: 'AVE-2026-1002',
      tipo_averia: 'Tubería rota',
      descripcion: 'Tubería matriz fracturada',
      estado: 'Finalizado',
      cedula_reportante: '202220333',
      nombre_reportante: 'Ana',
      apellido1_reportante: 'Rojas',
      apellido2_reportante: null,
      fecha_reporte: new Date('2026-01-20T14:30:00.000Z'),
      empleado: { id: 1, nombre: 'Carlos', apellido1: 'Fontanero' } as any,
      historial: [],
    },
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
        { tipo: 'Fuga de agua', total: '1' },
        { tipo: 'Tubería rota', total: '1' },
      ]),
      getMany: jest.fn().mockResolvedValue(mockAverias),
    };

    averiaRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    historialRepository = {
      find: jest.fn(),
      save: jest.fn(),
    };

    empleadoRepository = {
      findOneBy: jest.fn(),
    };

    abonadoRepository = {
      findOne: jest.fn(),
    };

    bitacoraService = {
      registrar: jest.fn(),
      registrarCreacion: jest.fn(),
      registrarCambioEstado: jest.fn(),
      historialDeRegistro: jest.fn().mockResolvedValue([]),
    };

    service = new AveriasService(
      averiaRepository,
      historialRepository,
      empleadoRepository,
      abonadoRepository,
      bitacoraService,
    );

    controller = new AveriasController(service);
  });

  describe('AveriasService.obtenerEstadisticas', () => {
    it('1. Consulta con rango de fechas válido retorna estadísticas agrupadas y listado (HTTP 200 / Ok)', async () => {
      const filtros: FiltroEstadisticasAveriasDto = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
      };

      // Mock de las agrupaciones específicas
      queryBuilderMock.getCount.mockResolvedValueOnce(2);
      queryBuilderMock.getRawMany
        .mockResolvedValueOnce([
          { tipo: 'Fuga de agua', total: '1' },
          { tipo: 'Tubería rota', total: '1' },
        ])
        .mockResolvedValueOnce([
          { estado: 'Pendiente', total: '1' },
          { estado: 'Finalizado', total: '1' },
        ]);
      queryBuilderMock.getMany.mockResolvedValueOnce(mockAverias);

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado).toBeDefined();
      expect(resultado.total).toBe(2);
      expect(resultado.porTipo).toEqual([
        { tipo: 'Fuga de agua', total: 1 },
        { tipo: 'Tubería rota', total: 1 },
      ]);
      expect(resultado.porEstado).toEqual([
        { estado: 'Pendiente', total: 1 },
        { estado: 'Finalizado', total: 1 },
      ]);
      expect(resultado.registros).toHaveLength(2);

      // Verificamos que se aplicaron las cláusulas WHERE para fechas
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'averia.fecha_reporte >= :inicio',
        { inicio: '2026-01-01 00:00:00' },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'averia.fecha_reporte <= :fin',
        { fin: '2026-01-31 23:59:59' },
      );
    });

    it('2. Consulta con filtros combinados por tipo y por estado aplica condiciones en SQL', async () => {
      const filtros: FiltroEstadisticasAveriasDto = {
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
        tipo: 'Fuga de agua',
        estado: 'Pendiente',
      };

      queryBuilderMock.getCount.mockResolvedValueOnce(1);
      queryBuilderMock.getRawMany
        .mockResolvedValueOnce([{ tipo: 'Fuga de agua', total: '1' }])
        .mockResolvedValueOnce([{ estado: 'Pendiente', total: '1' }]);
      queryBuilderMock.getMany.mockResolvedValueOnce([mockAverias[0]]);

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado.total).toBe(1);
      expect(resultado.porTipo).toEqual([{ tipo: 'Fuga de agua', total: 1 }]);
      expect(resultado.porEstado).toEqual([{ estado: 'Pendiente', total: 1 }]);
      expect(resultado.registros).toEqual([mockAverias[0]]);

      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'averia.tipo_averia = :tipo',
        { tipo: 'Fuga de agua' },
      );
      expect(queryBuilderMock.andWhere).toHaveBeenCalledWith(
        'averia.estado = :estado',
        { estado: 'Pendiente' },
      );
    });

    it('3. Validación de rango de fechas incoherente arroja BadRequestException (HTTP 400 Bad Request)', async () => {
      const filtrosIncoherentes: FiltroEstadisticasAveriasDto = {
        fechaInicio: '2026-02-15',
        fechaFin: '2026-02-01', // fechaInicio > fechaFin
      };

      await expect(
        service.obtenerEstadisticas(filtrosIncoherentes),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.obtenerEstadisticas(filtrosIncoherentes),
      ).rejects.toThrow('La fecha de inicio no puede ser posterior a la fecha de fin');
    });

    it('4. Consulta con combinación de filtros sin resultados retorna totales en 0 y arreglos vacíos sin error 500', async () => {
      const filtros: FiltroEstadisticasAveriasDto = {
        tipo: 'Tipo Inexistente',
        estado: 'Pendiente',
      };

      queryBuilderMock.getCount.mockResolvedValueOnce(0);

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado).toEqual({
        total: 0,
        porTipo: [],
        porEstado: [],
        registros: [],
      });

      // No debe ejecutar las consultas secundarias si el conteo inicial es 0
      expect(queryBuilderMock.getRawMany).not.toHaveBeenCalled();
      expect(queryBuilderMock.getMany).not.toHaveBeenCalled();
    });
  });

  describe('AveriasController.obtenerEstadisticas', () => {
    it('debe invocar al servicio con los filtros correspondientes', async () => {
      const filtros: FiltroEstadisticasAveriasDto = {
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
