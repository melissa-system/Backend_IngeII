import 'multer';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SolicitudesCambioPropietarioService } from './solicitudes.cambio-propietario.service';
import { CrearSolicitudCambioPropietarioDto } from '../dto/crear-solicitud-cambio-propietario.dto';
import { ActualizarEstadoSolicitudDto } from '../../common/dto/actualizar-estado-solicitud.dto';
import { ModuloBitacora } from '../../../bitacora/entities/bitacora.enums';
import type { RequestUser } from '../../../auth/strategies/jwt.strategy';

function crearArchivoFalso(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'documento_soporte',
    originalname: 'escritura.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('contenido-pdf-falso'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    encoding: '7bit',
    ...overrides,
  } as Express.Multer.File;
}

function coincide(fila: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([clave, valor]) => {
    if (valor && typeof valor === 'object' && typeof valor._type === 'string') {
      const op = valor as { _type: string; _value: unknown };
      if (op._type === 'in') {
        return (op._value as unknown[]).includes(fila[clave]);
      }
      const patron = String(op._value ?? '')
        .replace(/%/g, '')
        .toLowerCase();
      return String(fila[clave] ?? '').toLowerCase().includes(patron);
    }
    if (valor && typeof valor === 'object') {
      return coincide(fila[clave], valor);
    }
    return fila[clave] === valor;
  });
}

describe('SolicitudesCambioPropietarioService', () => {
  let service: SolicitudesCambioPropietarioService;

  let solicitudRepository: any;
  let detalleRepository: any;
  let documentoRepository: any;
  let abonadoRepository: any;
  let empleadoRepository: any;
  let userRepository: any;
  let historialRepository: any;
  let cloudinaryService: any;
  let bitacoraService: any;
  let mailService: any;

  let abonados: any[];
  let solicitudes: any[];
  let detalles: any[];
  let documentos: any[];
  let historial: any[];
  let siguienteSolicitudId: number;
  let siguienteDetalleId: number;
  let siguienteDocId: number;

  let abonadoActivo: any;
  let abonadoInactivo: any;

  beforeEach(() => {
    siguienteSolicitudId = 1;
    siguienteDetalleId = 1;
    siguienteDocId = 1;

    solicitudes = [];
    detalles = [];
    documentos = [];
    historial = [];

    abonadoActivo = {
      id: 1,
      numero_abonado: 'ABN-0001',
      nombre: 'Carlos Solis',
      cedula: '1-1000-1000',
      correo: 'carlos@test.com',
      telefono: '8888-1111',
      estado: 'Activo',
      usuario: { id: 10 },
    };

    abonadoInactivo = {
      id: 2,
      numero_abonado: 'ABN-0002',
      nombre: 'Elena Mora',
      cedula: '1-2000-2000',
      correo: 'elena@test.com',
      telefono: '8888-2222',
      estado: 'Inactivo',
      usuario: { id: 20 },
    };

    abonados = [abonadoActivo, abonadoInactivo];

    solicitudRepository = {
      create: jest.fn().mockImplementation((datos) => ({ ...datos })),
      save: jest.fn().mockImplementation(async (solicitud) => {
        if (!solicitud.id) {
          solicitud.id = siguienteSolicitudId++;
          solicitud.fecha_creacion = new Date();
          solicitud.fecha_actualizacion = new Date();
          solicitudes.push(solicitud);
        } else {
          const idx = solicitudes.findIndex((s) => s.id === solicitud.id);
          if (idx !== -1) {
            solicitud.fecha_actualizacion = new Date();
            solicitudes[idx] = { ...solicitudes[idx], ...solicitud };
          }
        }
        return { ...solicitud };
      }),
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        return solicitudes.find((s) => coincide(s, where)) ?? null;
      }),
      findOneBy: jest.fn().mockImplementation(async (where) => {
        return solicitudes.find((s) => coincide(s, where)) ?? null;
      }),
      find: jest.fn().mockImplementation(async ({ where }) => {
        return solicitudes.filter((s) => coincide(s, where));
      }),
    };

    detalleRepository = {
      create: jest.fn().mockImplementation((datos) => ({ ...datos })),
      save: jest.fn().mockImplementation(async (detalle) => {
        if (!detalle.id) {
          detalle.id = siguienteDetalleId++;
          detalles.push(detalle);
        } else {
          const idx = detalles.findIndex((d) => d.id === detalle.id);
          if (idx !== -1) detalles[idx] = { ...detalles[idx], ...detalle };
        }
        return { ...detalle };
      }),
      findOneBy: jest.fn().mockImplementation(async (where) => {
        return detalles.find((d) => coincide(d, where)) ?? null;
      }),
      find: jest.fn().mockImplementation(async ({ where }) => {
        return detalles.filter((d) => coincide(d, where));
      }),
    };

    documentoRepository = {
      create: jest.fn().mockImplementation((datos) => ({ ...datos })),
      save: jest.fn().mockImplementation(async (doc) => {
        doc.id = siguienteDocId++;
        doc.fecha_creacion = new Date();
        documentos.push(doc);
        return { ...doc };
      }),
    };

    abonadoRepository = {
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        return abonados.find((a) => coincide(a, where)) ?? null;
      }),
      findOneBy: jest.fn().mockImplementation(async (where) => {
        return abonados.find((a) => coincide(a, where)) ?? null;
      }),
    };

    empleadoRepository = {
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        if (where?.usuario?.id === 1) {
          return { id: 101, nombre: 'Admin Empleado', usuario: { id: 1 } };
        }
        return null;
      }),
    };

    userRepository = {
      findOneBy: jest.fn().mockImplementation(async ({ id }) => ({
        id,
        email: `usuario-${id}@asada.cr`,
      })),
    };

    historialRepository = {
      create: jest.fn().mockImplementation((datos) => ({ ...datos })),
      save: jest.fn().mockImplementation(async (entradas) => {
        if (Array.isArray(entradas)) historial.push(...entradas);
        else historial.push(entradas);
        return entradas;
      }),
    };

    cloudinaryService = {
      subirArchivo: jest.fn().mockResolvedValue({
        url: 'https://cloudinary.com/escritura.pdf',
        publicId: 'solicitudes/cambio-propietario/doc123',
      }),
      eliminarArchivo: jest.fn().mockResolvedValue(undefined),
    };

    bitacoraService = {
      registrarCreacion: jest.fn().mockResolvedValue(undefined),
      registrarCambioEstado: jest.fn().mockResolvedValue(undefined),
    };

    mailService = {
      enviarCorreoResultadoCambioPropietario: jest.fn().mockResolvedValue(undefined),
    };

    service = new SolicitudesCambioPropietarioService(
      solicitudRepository,
      detalleRepository,
      documentoRepository,
      abonadoRepository,
      empleadoRepository,
      userRepository,
      historialRepository,
      cloudinaryService,
      bitacoraService,
      mailService,
    );
  });

  const dtoValido: CrearSolicitudCambioPropietarioDto = {
    nombreNuevoPropietario: 'Roberto Fernandez',
    cedulaNuevoPropietario: '2-0555-0555',
    telefonoNuevoPropietario: '8765-4321',
    correoNuevoPropietario: 'roberto@nuevo.cr',
    motivoTraspaso: 'Compraventa',
    justificacion: 'Se compró la propiedad mediante escritura pública formal',
  };

  describe('crear() - Reglas de negocio y antisuplantación', () => {
    it('201 Created: creación exitosa por rol abonado (autoservicio)', async () => {
      const userAbonado: RequestUser = { id: 10, role: 'abonado' };
      const archivo = crearArchivoFalso();

      const res = await service.crear(dtoValido, archivo, userAbonado);

      expect(res.codigo_solicitud).toMatch(/^SOL-PRO-\d{4}-\d{4}$/);
      expect(res.estado).toBe('pendiente');
      expect(res.nombre_nuevo_propietario).toBe(dtoValido.nombreNuevoPropietario);
      expect(res.documento_soporte_url).toBe('https://cloudinary.com/escritura.pdf');
      expect(cloudinaryService.subirArchivo).toHaveBeenCalledWith(
        archivo,
        'solicitudes/cambio-propietario',
      );
      expect(documentos).toHaveLength(1);
      expect(documentos[0].tipo_documento).toBe('documento_soporte');
      expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
        ModuloBitacora.SOLICITUDES,
        expect.any(Number),
        { id: 10, email: 'usuario-10@asada.cr' },
        'Solicitud de cambio de propietario creada',
      );
    });

    it('403 Forbidden: debe rechazar con 403 si un abonado intenta enviar un idAbonado ajeno', async () => {
      const userAbonado: RequestUser = { id: 10, role: 'abonado' };
      const archivo = crearArchivoFalso();
      const dtoSuplantacion = { ...dtoValido, idAbonado: 999 };

      await expect(
        service.crear(dtoSuplantacion, archivo, userAbonado),
      ).rejects.toThrow(ForbiddenException);
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('201 Created: creación exitosa por rol administrador (ventanilla asistida)', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const archivo = crearArchivoFalso();
      const dtoAdmin = { ...dtoValido, idAbonado: 1 };

      const res = await service.crear(dtoAdmin, archivo, userAdmin);

      expect(res.codigo_solicitud).toMatch(/^SOL-PRO-\d{4}-\d{4}$/);
      expect(res.id_empleado).toBe(101);
      expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
        ModuloBitacora.SOLICITUDES,
        expect.any(Number),
        { id: 1, email: 'usuario-1@asada.cr' },
        'Solicitud de cambio de propietario creada',
      );
    });

    it('400 Bad Request: admin debe seleccionar obligatoriamente un abonado', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const archivo = crearArchivoFalso();

      await expect(service.crear(dtoValido, archivo, userAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('400 Bad Request: debe rechazar si el abonado está inactivo', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const archivo = crearArchivoFalso();
      const dtoInactivo = { ...dtoValido, idAbonado: 2 };

      await expect(service.crear(dtoInactivo, archivo, userAdmin)).rejects.toThrow(
        'El abonado está inactivo y no puede generar solicitudes',
      );
    });

    it('400 Bad Request: la cédula del nuevo propietario no puede ser idéntica a la actual', async () => {
      const userAbonado: RequestUser = { id: 10, role: 'abonado' };
      const archivo = crearArchivoFalso();
      const dtoMismaCedula = {
        ...dtoValido,
        cedulaNuevoPropietario: '110001000', // Mismos dígitos que 1-1000-1000
      };

      await expect(
        service.crear(dtoMismaCedula, archivo, userAbonado),
      ).rejects.toThrow('La cédula del nuevo propietario debe ser distinta');
    });

    it('400 Bad Request: no debe permitir crear una solicitud si ya existe una abierta en curso', async () => {
      const userAbonado: RequestUser = { id: 10, role: 'abonado' };
      const archivo = crearArchivoFalso();

      // Primera solicitud (exitosa)
      await service.crear(dtoValido, archivo, userAbonado);

      // Intento de segunda solicitud mientras la primera está en 'pendiente'
      await expect(
        service.crear(dtoValido, archivo, userAbonado),
      ).rejects.toThrow(/Ya existe una solicitud de cambio de propietario en curso/);
    });

    it('Rollback de Cloudinary si falla el guardado en base de datos', async () => {
      const userAbonado: RequestUser = { id: 10, role: 'abonado' };
      const archivo = crearArchivoFalso();

      solicitudRepository.save.mockRejectedValueOnce(new Error('Fallo de base de datos'));

      await expect(service.crear(dtoValido, archivo, userAbonado)).rejects.toThrow(
        'Fallo de base de datos',
      );
      expect(cloudinaryService.eliminarArchivo).toHaveBeenCalledWith(
        'solicitudes/cambio-propietario/doc123',
        false,
      );
    });
  });

  describe('cambiarEstado() y Auditoría en Bitácora', () => {
    let solicitudCreadaId: number;

    beforeEach(async () => {
      const userAbonado: RequestUser = { id: 10, role: 'abonado' };
      const archivo = crearArchivoFalso();
      const creada = await service.crear(dtoValido, archivo, userAbonado);
      solicitudCreadaId = creada.id;
    });

    it('debe aprobar la solicitud, registrar auditoría en Bitácora e historial de abonado', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const dtoEstado: ActualizarEstadoSolicitudDto = { estado: 'aprobado' };

      const res = await service.cambiarEstado(solicitudCreadaId, dtoEstado, userAdmin);

      expect(res.estado).toBe('aprobado');
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        ModuloBitacora.SOLICITUDES,
        solicitudCreadaId,
        { id: 1, email: 'usuario-1@asada.cr' },
        'pendiente',
        'aprobado',
        'Actualización de estado',
      );
      expect(historial.length).toBeGreaterThan(0);
      expect(mailService.enviarCorreoResultadoCambioPropietario).toHaveBeenCalled();
    });

    it('debe rechazar la solicitud guardando el motivo de rechazo en detalle y bitácora', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      const dtoEstado: ActualizarEstadoSolicitudDto = {
        estado: 'rechazado',
        motivoRechazo: 'Escritura pública no legible ni vigente',
      };

      const res = await service.cambiarEstado(solicitudCreadaId, dtoEstado, userAdmin);

      expect(res.estado).toBe('rechazado');
      expect(res.motivo_rechazo).toBe('Escritura pública no legible ni vigente');
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        ModuloBitacora.SOLICITUDES,
        solicitudCreadaId,
        { id: 1, email: 'usuario-1@asada.cr' },
        'pendiente',
        'rechazado',
        'Escritura pública no legible ni vigente',
      );
    });

    it('400 Bad Request: no debe permitir modificar una solicitud ya cerrada', async () => {
      const userAdmin: RequestUser = { id: 1, role: 'admin' };
      await service.cambiarEstado(solicitudCreadaId, { estado: 'aprobado' }, userAdmin);

      await expect(
        service.cambiarEstado(solicitudCreadaId, { estado: 'rechazado' }, userAdmin),
      ).rejects.toThrow(/La solicitud ya está cerrada/);
    });
  });
});

