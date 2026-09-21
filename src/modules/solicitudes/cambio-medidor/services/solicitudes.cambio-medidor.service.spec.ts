import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SolicitudesCambioMedidorService } from './solicitudes.cambio-medidor.service';
import { CrearSolicitudCambioMedidorDto } from '../dto/crear-solicitud-cambio-medidor.dto';

// Prueba el flujo de las solicitudes de cambio de medidor a nivel de
// servicio, con los repositorios, Cloudinary, el correo y la bitácora
// simulados. Cubre: creación (abonado y administrador), validaciones,
// cambios de estado, notificación por correo y auditoría en la bitácora.

// "Base de datos" en memoria: find/findOne filtran sobre arreglos según el
// `where` recibido, igual que haría MySQL. Soporta In(...) y filtros sobre
// relaciones anidadas (abonado.id, usuario.id, solicitud.id).
function coincide(fila: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([clave, valor]) => {
    if (valor && typeof valor === 'object' && typeof valor._type === 'string') {
      if (valor._type === 'in') return (valor._value as unknown[]).includes(fila[clave]);
      return false;
    }
    if (valor && typeof valor === 'object') return fila[clave] != null && coincide(fila[clave], valor);
    return fila[clave] === valor;
  });
}

function repositorioEnMemoria(filas: any[]) {
  let siguienteId = 1;
  return {
    filas,
    findOne: jest.fn(({ where } = {} as any) =>
      Promise.resolve(filas.find((f) => coincide(f, where)) ?? null),
    ),
    findOneBy: jest.fn((where: Record<string, any>) =>
      Promise.resolve(filas.find((f) => coincide(f, where)) ?? null),
    ),
    find: jest.fn(({ where } = {} as any) =>
      Promise.resolve(where ? filas.filter((f) => coincide(f, where)) : [...filas]),
    ),
    create: jest.fn((datos: any) => ({ ...datos })),
    save: jest.fn((fila: any) => {
      if (fila.id === undefined) fila.id = siguienteId++;
      const idx = filas.findIndex((f) => f.id === fila.id);
      if (idx >= 0) {
        Object.assign(filas[idx], fila);
        return Promise.resolve(filas[idx]);
      }
      filas.push(fila);
      return Promise.resolve(fila);
    }),
  };
}

function evidenciaFalsa(): Express.Multer.File {
  return {
    fieldname: 'evidencia',
    originalname: 'medidor.jpg',
    mimetype: 'image/jpeg',
    size: 1000,
    buffer: Buffer.from('foto'),
  } as Express.Multer.File;
}

describe('SolicitudesCambioMedidorService', () => {
  let service: SolicitudesCambioMedidorService;
  let solicitudes: ReturnType<typeof repositorioEnMemoria>;
  let detalles: ReturnType<typeof repositorioEnMemoria>;
  let abonados: ReturnType<typeof repositorioEnMemoria>;
  let empleados: ReturnType<typeof repositorioEnMemoria>;
  let usuarios: ReturnType<typeof repositorioEnMemoria>;
  let cloudinaryService: any;
  let mailService: any;
  let bitacoraService: any;

  const abonadoPeticion = { id: 5, role: 'abonado' } as any;
  const adminPeticion = { id: 7, role: 'admin' } as any;

  const dto: CrearSolicitudCambioMedidorDto = {
    motivoFalla: 'Dañado',
    direccionExacta: 'Pueblo Nuevo, 200 m norte de la escuela',
    justificacion: 'El medidor no marca el consumo',
  };

  beforeEach(() => {
    solicitudes = repositorioEnMemoria([]);
    detalles = repositorioEnMemoria([]);
    abonados = repositorioEnMemoria([
      { id: 1, numero_abonado: 'ABN-0001', nombre: 'Ana Rojas', cedula: '1-1111-1111',
        correo: 'ana@asada.test', estado: 'Activo', usuario: { id: 5 } },
      { id: 2, numero_abonado: 'ABN-0002', nombre: 'Luis Mora', cedula: '2-2222-2222',
        correo: 'luis@asada.test', estado: 'Inactivo', usuario: { id: 6 } },
    ]);
    empleados = repositorioEnMemoria([{ id: 3, nombre: 'Admin ASADA', usuario: { id: 7 } }]);
    usuarios = repositorioEnMemoria([
      { id: 5, email: 'ana@asada.test' },
      { id: 7, email: 'admin@asada.test' },
    ]);
    cloudinaryService = {
      subirArchivo: jest.fn(() =>
        Promise.resolve({ url: 'https://cloudinary.test/medidor.jpg', publicId: 'medidor/abc' }),
      ),
    };
    mailService = { enviarCorreoResultadoSolicitud: jest.fn(() => Promise.resolve()) };
    bitacoraService = {
      registrarCreacion: jest.fn(() => Promise.resolve()),
      registrarCambioEstado: jest.fn(() => Promise.resolve()),
    };

    service = new SolicitudesCambioMedidorService(
      solicitudes as any,
      detalles as any,
      abonados as any,
      empleados as any,
      usuarios as any,
      cloudinaryService,
      mailService,
      bitacoraService,
    );
  });

  async function crearPendiente() {
    const creada = await service.crear(dto, evidenciaFalsa(), abonadoPeticion);
    bitacoraService.registrarCreacion.mockClear();
    return creada.id;
  }

  // --- Creación ---
  describe('crear', () => {
    it('crea una solicitud pendiente para el abonado logueado y sube la evidencia', async () => {
      const creada = await service.crear(dto, evidenciaFalsa(), abonadoPeticion);

      expect(creada.estado).toBe('pendiente');
      expect(creada.codigo_solicitud).toMatch(/^SOL-MED-\d{4}-\d{4}$/);
      expect(creada.id_abonado).toBe(1);
      expect(creada.evidencia_url).toBe('https://cloudinary.test/medidor.jpg');
      expect(cloudinaryService.subirArchivo).toHaveBeenCalledTimes(1);
    });

    it('audita la creación con el correo de quien la hizo', async () => {
      const creada = await service.crear(dto, evidenciaFalsa(), abonadoPeticion);

      expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
        'solicitudes',
        creada.id,
        { id: 5, email: 'ana@asada.test' },
        expect.stringContaining(creada.codigo_solicitud),
      );
    });

    it('un administrador debe indicar para qué abonado es la solicitud', async () => {
      await expect(service.crear(dto, evidenciaFalsa(), adminPeticion)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza la solicitud de un abonado inactivo', async () => {
      await expect(
        service.crear({ ...dto, idAbonado: 2 }, evidenciaFalsa(), adminPeticion),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('no permite una segunda solicitud mientras haya otra abierta', async () => {
      await service.crear(dto, evidenciaFalsa(), abonadoPeticion);
      await expect(service.crear(dto, evidenciaFalsa(), abonadoPeticion)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // --- Cambio de estado ---
  describe('cambiarEstado', () => {
    it('marcar en proceso audita el cambio y no envía correo', async () => {
      const id = await crearPendiente();

      const r = await service.cambiarEstado(id, { estado: 'en_proceso' }, adminPeticion);

      expect(r.estado).toBe('en_proceso');
      expect(r.id_empleado).toBe(3);
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        'solicitudes', id, { id: 7, email: 'admin@asada.test' },
        'pendiente', 'en_proceso', expect.any(String),
      );
      expect(mailService.enviarCorreoResultadoSolicitud).not.toHaveBeenCalled();
    });

    it('rechazar guarda el motivo, lo audita y se lo notifica al abonado', async () => {
      const id = await crearPendiente();
      const motivo = 'La foto no muestra el medidor';

      const r = await service.cambiarEstado(
        id, { estado: 'rechazado', motivoRechazo: motivo }, adminPeticion,
      );

      expect(r.estado).toBe('rechazado');
      expect(r.motivo_rechazo).toBe(motivo);
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        'solicitudes', id, expect.anything(), 'pendiente', 'rechazado', motivo,
      );
      expect(mailService.enviarCorreoResultadoSolicitud).toHaveBeenCalledWith(
        'ana@asada.test',
        expect.objectContaining({ estadoResultado: 'rechazado', motivo }),
      );
    });

    it('aprobar notifica al abonado con el código de la solicitud', async () => {
      const id = await crearPendiente();
      const codigo = solicitudes.filas[0].codigo_solicitud;

      await service.cambiarEstado(id, { estado: 'aprobado' }, adminPeticion);

      expect(mailService.enviarCorreoResultadoSolicitud).toHaveBeenCalledWith(
        'ana@asada.test',
        expect.objectContaining({ codigo, estadoResultado: 'aprobado' }),
      );
    });

    it('si falla el correo, el cambio de estado y la auditoría se conservan', async () => {
      const id = await crearPendiente();
      mailService.enviarCorreoResultadoSolicitud.mockImplementationOnce(() =>
        Promise.reject(new Error('SMTP caído')),
      );
      const silenciar = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const r = await service.cambiarEstado(id, { estado: 'aprobado' }, adminPeticion);

      expect(r.estado).toBe('aprobado');
      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledTimes(1);
      silenciar.mockRestore();
    });

    it('una solicitud cerrada no admite más cambios ni deja rastro en la bitácora', async () => {
      const id = await crearPendiente();
      await service.cambiarEstado(id, { estado: 'aprobado' }, adminPeticion);
      bitacoraService.registrarCambioEstado.mockClear();

      await expect(
        service.cambiarEstado(id, { estado: 'en_proceso' }, adminPeticion),
      ).rejects.toThrow(BadRequestException);
      expect(bitacoraService.registrarCambioEstado).not.toHaveBeenCalled();
    });

    it('responde 404 si la solicitud no existe', async () => {
      await expect(
        service.cambiarEstado(999, { estado: 'aprobado' }, adminPeticion),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Listado ---
  describe('listar', () => {
    it('un abonado solo ve sus propias solicitudes', async () => {
      await service.crear(dto, evidenciaFalsa(), abonadoPeticion);
      const otroAbonado = { id: 99, role: 'abonado' } as any;

      expect(await service.listar(abonadoPeticion)).toHaveLength(1);
      expect(await service.listar(otroAbonado)).toHaveLength(0);
    });
  });
});
