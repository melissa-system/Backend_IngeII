import { BadRequestException } from '@nestjs/common';
import { SolicitudesEstadisticasService } from './solicitudes-estadisticas.service';
import { SolicitudesEstadisticasController } from '../controllers/solicitudes-estadisticas.controller';
import { Solicitud } from '../../common/entities/solicitud.entity';
import { SolicitudPajaAgua } from '../../paja-agua/entities/solicitud-paja-agua.entity';
import { FiltroEstadisticasSolicitudesDto } from '../dto/filtro-estadisticas-solicitudes.dto';

describe('Solicitudes Estadísticas (PBI reportes)', () => {
  let service: SolicitudesEstadisticasService;
  let controller: SolicitudesEstadisticasController;

  let solicitudRepository: any;
  let pajaAguaRepository: any;

  const mockGenericas: Solicitud[] = [
    {
      id: 1,
      codigo_solicitud: 'SOL-GEN-001',
      tipo_solicitud: 'cambio_propietario',
      estado: 'pendiente',
      fecha_creacion: new Date('2026-01-15T10:00:00'),
      fecha_actualizacion: new Date('2026-01-15T10:00:00'),
      empleado: null,
      abonado: {
        nombre: 'Juan',
        fisico: { apellido1: 'Pérez', apellido2: 'Mora' },
      } as any,
    } as Solicitud,
    {
      id: 2,
      codigo_solicitud: 'SOL-GEN-002',
      tipo_solicitud: 'cambio_medidor',
      estado: 'aprobado',
      fecha_creacion: new Date('2026-03-01T09:00:00'),
      fecha_actualizacion: new Date('2026-03-01T09:00:00'),
      empleado: null,
      abonado: {
        nombre: 'ASADA Pueblo Nuevo',
        fisico: null,
      } as any,
    } as Solicitud,
  ];

  const mockPajas: SolicitudPajaAgua[] = [
    {
      id: 10,
      codigo_solicitud: 'SOL-PA-001',
      tipo_persona: 'fisica',
      nombre_solicitante: 'Ana Rojas',
      identificacion: '1-1111-2222',
      telefono: '8888-1111',
      correo: 'ana@email.com',
      direccion: 'Pueblo Nuevo',
      numero_plano: 'P-001',
      estado: 'Aprobada',
      fecha_solicitud: new Date('2026-02-10T08:00:00'),
      empleado: null,
    } as SolicitudPajaAgua,
    {
      id: 11,
      codigo_solicitud: 'SOL-PA-002',
      tipo_persona: 'juridica',
      nombre_solicitante: 'Carlos Mora',
      identificacion: '3-101-111111',
      telefono: '8888-2222',
      correo: 'carlos@email.com',
      direccion: 'Centro',
      numero_plano: 'P-002',
      estado: 'Rechazada',
      fecha_solicitud: new Date('2026-04-05T11:00:00'),
      empleado: null,
    } as SolicitudPajaAgua,
  ];

  beforeEach(() => {
    solicitudRepository = { find: jest.fn().mockResolvedValue(mockGenericas) };
    pajaAguaRepository = { find: jest.fn().mockResolvedValue(mockPajas) };

    service = new SolicitudesEstadisticasService(
      solicitudRepository,
      pajaAguaRepository,
    );
    controller = new SolicitudesEstadisticasController(service);
  });

  describe('SolicitudesEstadisticasService.obtenerEstadisticas', () => {
    it('1. Agrega solicitudes genéricas y de paja de agua en un solo contrato normalizado', async () => {
      const filtros: FiltroEstadisticasSolicitudesDto = {};

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado.total).toBe(4);
      expect(resultado.porTipo).toEqual([
        { tipo: 'Paja de agua', total: 2 },
        { tipo: 'Cambio de medidor', total: 1 },
        { tipo: 'Cambio de propietario', total: 1 },
      ]);
      expect(resultado.porEstado).toEqual([
        { estado: 'Aprobada', total: 2 },
        { estado: 'Rechazada', total: 1 },
        { estado: 'Pendiente', total: 1 },
      ]);
      expect(resultado.registros).toHaveLength(4);
      const generica = resultado.registros.find(
        (r) => r.codigo === 'SOL-GEN-001',
      );
      expect(generica).toEqual({
        codigo: 'SOL-GEN-001',
        tipo: 'Cambio de propietario',
        solicitante: 'Juan Pérez Mora',
        estado: 'Pendiente',
        fecha: '2026-01-15',
      });
      const paja = resultado.registros.find((r) => r.codigo === 'SOL-PA-001');
      expect(paja).toEqual({
        codigo: 'SOL-PA-001',
        tipo: 'Paja de agua',
        solicitante: 'Ana Rojas',
        estado: 'Aprobada',
        fecha: '2026-02-10',
      });
      // Orden descendente por fecha
      expect(resultado.registros[0].fecha).toBe('2026-04-05');
    });

    it('2. Filtra por tipo y por estado sobre las etiquetas normalizadas', async () => {
      const filtros: FiltroEstadisticasSolicitudesDto = {
        tipo: 'Paja de agua',
        estado: 'Aprobada',
      };

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado.total).toBe(1);
      expect(resultado.registros).toEqual([
        {
          codigo: 'SOL-PA-001',
          tipo: 'Paja de agua',
          solicitante: 'Ana Rojas',
          estado: 'Aprobada',
          fecha: '2026-02-10',
        },
      ]);
    });

    it('3. Filtra por rango de fechas usando la porción YYYY-MM-DD del registro', async () => {
      const filtros: FiltroEstadisticasSolicitudesDto = {
        fechaInicio: '2026-02-01',
        fechaFin: '2026-03-31',
      };

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado.total).toBe(2);
      expect(resultado.registros.map((r) => r.codigo).sort()).toEqual([
        'SOL-GEN-002',
        'SOL-PA-001',
      ]);
    });

    it('4. Validación de rango de fechas incoherente arroja BadRequestException', async () => {
      const filtrosIncoherentes: FiltroEstadisticasSolicitudesDto = {
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

    it('5. Consulta sin resultados retorna total 0 con arreglos vacíos', async () => {
      const filtros: FiltroEstadisticasSolicitudesDto = {
        tipo: 'Tipo Inexistente',
      };

      const resultado = await service.obtenerEstadisticas(filtros);

      expect(resultado).toEqual({
        total: 0,
        porTipo: [],
        porEstado: [],
        registros: [],
      });
    });
  });

  describe('SolicitudesEstadisticasController.obtenerEstadisticas', () => {
    it('debe invocar al servicio con los filtros correspondientes', async () => {
      const filtros: FiltroEstadisticasSolicitudesDto = {
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
