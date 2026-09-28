import 'multer';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SolicitudesCambioPropietarioController } from './solicitudes.cambio-propietario.controller';
import { SolicitudesCambioPropietarioService } from '../services/solicitudes.cambio-propietario.service';
import type { SolicitudCambioPropietarioResponse } from '../services/solicitudes.cambio-propietario.service';
import { CrearSolicitudCambioPropietarioDto } from '../dto/crear-solicitud-cambio-propietario.dto';
import { ActualizarEstadoSolicitudDto } from '../../common/dto/actualizar-estado-solicitud.dto';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';

describe('SolicitudesCambioPropietarioController', () => {
  let controller: SolicitudesCambioPropietarioController;
  let service: SolicitudesCambioPropietarioService;

  const mockFile: Express.Multer.File = {
    fieldname: 'documento_soporte',
    originalname: 'escritura.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake-pdf-content'),
    size: 1024,
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockResponse: SolicitudCambioPropietarioResponse = {
    id: 10,
    codigo_solicitud: 'SOL-PRO-2026-1001',
    id_abonado: 1,
    numero_abonado: 'ABN-0001',
    nombre_abonado: 'Juan Perez',
    cedula: '1-1111-1111',
    correo: 'juan@test.com',
    telefono: '8888-8888',
    tipo_solicitud: 'cambio_propietario',
    estado: 'pendiente',
    nombre_nuevo_propietario: 'Maria Rodriguez',
    cedula_nuevo_propietario: '2-2222-2222',
    telefono_nuevo_propietario: '7777-7777',
    correo_nuevo_propietario: 'maria@test.com',
    motivo_traspaso: 'Compraventa',
    justificacion: 'Traspaso de lote con escritura publica',
    documento_soporte_url: 'https://cloudinary.com/doc.pdf',
    motivo_rechazo: null,
    id_empleado: null,
    fecha_creacion: new Date(),
    fecha_actualizacion: new Date(),
  };

  const mockService = {
    crear: jest.fn(),
    listar: jest.fn(),
    cambiarEstado: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesCambioPropietarioController],
      providers: [
        {
          provide: SolicitudesCambioPropietarioService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SolicitudesCambioPropietarioController>(
      SolicitudesCambioPropietarioController,
    );
    service = module.get<SolicitudesCambioPropietarioService>(
      SolicitudesCambioPropietarioService,
    );
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('crear (POST /solicitudes/cambio-propietario)', () => {
    const dto: CrearSolicitudCambioPropietarioDto = {
      nombreNuevoPropietario: 'Maria Rodriguez',
      cedulaNuevoPropietario: '2-2222-2222',
      telefonoNuevoPropietario: '7777-7777',
      correoNuevoPropietario: 'maria@test.com',
      motivoTraspaso: 'Compraventa',
      justificacion: 'Traspaso de lote con escritura publica',
    };

    it('400 Bad Request: debe lanzar error si no se adjunta el documento legal de soporte', async () => {
      const userAbonado: RequestUser = { id: 5, role: 'abonado' };

      await expect(
        controller.crear(dto, null as any, { user: userAbonado }),
      ).rejects.toThrow(BadRequestException);
      expect(mockService.crear).not.toHaveBeenCalled();
    });

    it('201 Created: debe permitir a un abonado crear su solicitud en autoservicio', async () => {
      const userAbonado: RequestUser = { id: 5, role: 'abonado' };
      mockService.crear.mockResolvedValue(mockResponse);

      const resultado = await controller.crear(dto, mockFile, {
        user: userAbonado,
      });

      expect(mockService.crear).toHaveBeenCalledWith(dto, mockFile, userAbonado);
      expect(resultado).toEqual(mockResponse);
      expect(resultado.codigo_solicitud).toMatch(/^SOL-PRO-\d{4}-\d{4}$/);
    });

    it('201 Created: debe permitir a un administrador crear la solicitud en ventanilla asistida', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const dtoAdmin: CrearSolicitudCambioPropietarioDto = {
        ...dto,
        idAbonado: 1,
      };
      const respAdmin = { ...mockResponse, id_empleado: 2 };
      mockService.crear.mockResolvedValue(respAdmin);

      const resultado = await controller.crear(dtoAdmin, mockFile, {
        user: userAdmin,
      });

      expect(mockService.crear).toHaveBeenCalledWith(
        dtoAdmin,
        mockFile,
        userAdmin,
      );
      expect(resultado.id_empleado).toBe(2);
    });

    it('403 Forbidden: debe propagar ForbiddenException si un abonado intenta suplantar a otro', async () => {
      const userAbonado: RequestUser = { id: 5, role: 'abonado' };
      const dtoSuplantacion: CrearSolicitudCambioPropietarioDto = {
        ...dto,
        idAbonado: 999, // Id ajeno
      };
      mockService.crear.mockRejectedValue(
        new ForbiddenException(
          'No tienes permiso para solicitar un cambio de propietario en nombre de otro abonado',
        ),
      );

      await expect(
        controller.crear(dtoSuplantacion, mockFile, { user: userAbonado }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listar (GET /solicitudes/cambio-propietario)', () => {
    it('debe retornar las solicitudes delegando al servicio según el usuario en sesión', async () => {
      const user: RequestUser = { id: 5, role: 'abonado' };
      mockService.listar.mockResolvedValue([mockResponse]);

      const resultado = await controller.listar({ user });

      expect(mockService.listar).toHaveBeenCalledWith(user);
      expect(resultado).toEqual([mockResponse]);
    });
  });

  describe('cambiarEstado (PATCH /solicitudes/cambio-propietario/:id/estado)', () => {
    it('debe actualizar el estado de la solicitud', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const dtoEstado: ActualizarEstadoSolicitudDto = {
        estado: 'aprobado',
      };
      const respAprobada = { ...mockResponse, estado: 'aprobado' };
      mockService.cambiarEstado.mockResolvedValue(respAprobada);

      const resultado = await controller.cambiarEstado(10, dtoEstado, {
        user: userAdmin,
      });

      expect(mockService.cambiarEstado).toHaveBeenCalledWith(
        10,
        dtoEstado,
        userAdmin,
      );
      expect(resultado.estado).toBe('aprobado');
    });
  });
});

