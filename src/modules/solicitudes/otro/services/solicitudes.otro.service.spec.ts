import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SolicitudesOtroService } from './solicitudes.otro.service';
import { CrearSolicitudOtroDto } from '../dto/crear-solicitud-otro.dto';

// Prueba el flujo de las solicitudes de tipo "Otro" a nivel de servicio. A
// diferencia de los demás trámites, acá el archivo de soporte es opcional y
// el comentario del administrador se guarda y se envía tanto al aprobar como
// al rechazar, porque es la única constancia de lo que se resolvió.

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

function adjuntoFalso(): Express.Multer.File {
  return {
    fieldname: 'adjunto',
    originalname: 'soporte.pdf',
    mimetype: 'application/pdf',
    size: 1000,
    buffer: Buffer.from('pdf'),
  } as Express.Multer.File;
}

describe('SolicitudesOtroService', () => {
  let service: SolicitudesOtroService;
  let solicitudes: ReturnType<typeof repositorioEnMemoria>;
  let detalles: ReturnType<typeof repositorioEnMemoria>;
  let cloudinaryService: any;
  let mailService: any;
  let bitacoraService: any;

  const abonadoPeticion = { id: 5, role: 'abonado' } as any;
  const adminPeticion = { id: 7, role: 'admin' } as any;

  const dto: CrearSolicitudOtroDto = {
    asunto: 'Consulta sobre el cobro del mes de agosto',
    justificacion: 'El recibo de agosto viene con un monto mayor al habitual.',
  };

  beforeEach(() => {
    solicitudes = repositorioEnMemoria([]);
    detalles = repositorioEnMemoria([]);
    const abonados = repositorioEnMemoria([
      { id: 1, numero_abonado: 'ABN-0001', nombre: 'Ana Rojas', cedula: '1-1111-1111',
        correo: 'ana@asada.test', estado: 'Activo', usuario: { id: 5 } },
    ]);
    const empleados = repositorioEnMemoria([{ id: 3, nombre: 'Admin ASADA', usuario: { id: 7 } }]);
    const usuarios = repositorioEnMemoria([
      { id: 5, email: 'ana@asada.test' },
      { id: 7, email: 'admin@asada.test' },
    ]);
    cloudinaryService = {
      subirArchivo: jest.fn(() =>
        Promise.resolve({ url: 'https://cloudinary.test/soporte.pdf', publicId: 'otro/abc' }),
      ),
    };
    mailService = { enviarCorreoResultadoOtro: jest.fn(() => Promise.resolve()) };
    bitacoraService = {
      registrarCreacion: jest.fn(() => Promise.resolve()),
      registrarCambioEstado: jest.fn(() => Promise.resolve()),
    };

    // Mismo orden que el constructor: primero los repositorios, después los
    // servicios (ver el comentario sobre el orden en el service).
    service = new SolicitudesOtroService(
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
    const creada = await service.crear(dto, undefined as any, abonadoPeticion);
    bitacoraService.registrarCreacion.mockClear();
    return creada.id;
  }

  describe('crear', () => {
    it('sin archivo de soporte crea la solicitud sin subir nada a la nube', async () => {
      const creada = await service.crear(dto, undefined as any, abonadoPeticion);

      expect(creada.estado).toBe('pendiente');
      expect(creada.codigo_solicitud).toMatch(/^SOL-OTRO-\d{4}-\d{4}$/);
      expect(creada.adjunto_url).toBeNull();
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('con archivo de soporte lo sube y guarda su URL', async () => {
      const creada = await service.crear(dto, adjuntoFalso(), abonadoPeticion);
      expect(creada.adjunto_url).toBe('https://cloudinary.test/soporte.pdf');
    });

    it('audita la creación incluyendo el asunto', async () => {
      const creada = await service.crear(dto, undefined as any, abonadoPeticion);

      expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
        'solicitudes',
        creada.id,
        { id: 5, email: 'ana@asada.test' },
        expect.stringContaining(dto.asunto),
      );
    });

    it('no permite una segunda solicitud mientras haya otra abierta', async () => {
      await service.crear(dto, undefined as any, abonadoPeticion);
      await expect(service.crear(dto, undefined as any, abonadoPeticion)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cambiarEstado', () => {
    it('al aprobar guarda el comentario de resolución y lo envía por correo', async () => {
      const id = await crearPendiente();
      const comentario = 'Se revisó el cobro y se aplicará un ajuste.';

      const r = await service.cambiarEstado(
        id, { estado: 'aprobado', motivoRechazo: comentario }, adminPeticion,
      );

      expect(r.estado).toBe('aprobado');
      expect(r.motivo_rechazo).toBe(comentario);
      expect(mailService.enviarCorreoResultadoOtro).toHaveBeenCalledWith(
        'ana@asada.test',
        expect.objectContaining({ estadoResultado: 'aprobado', comentario, asunto: dto.asunto }),
      );
    });

    it('audita cada cambio de estado con el comentario', async () => {
      const id = await crearPendiente();
      const comentario = 'No corresponde a un trámite de la ASADA.';

      await service.cambiarEstado(id, { estado: 'rechazado', motivoRechazo: comentario }, adminPeticion);

      expect(bitacoraService.registrarCambioEstado).toHaveBeenCalledWith(
        'solicitudes', id, { id: 7, email: 'admin@asada.test' },
        'pendiente', 'rechazado', comentario,
      );
    });

    it('marcar en proceso no envía correo', async () => {
      const id = await crearPendiente();
      await service.cambiarEstado(id, { estado: 'en_proceso' }, adminPeticion);
      expect(mailService.enviarCorreoResultadoOtro).not.toHaveBeenCalled();
    });

    it('si falla el correo, el cambio de estado se conserva', async () => {
      const id = await crearPendiente();
      mailService.enviarCorreoResultadoOtro.mockImplementationOnce(() =>
        Promise.reject(new Error('SMTP caído')),
      );
      const silenciar = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const r = await service.cambiarEstado(
        id, { estado: 'aprobado', motivoRechazo: 'Resuelto en ventanilla.' }, adminPeticion,
      );

      expect(r.estado).toBe('aprobado');
      silenciar.mockRestore();
    });

    it('una solicitud cerrada no admite más cambios', async () => {
      const id = await crearPendiente();
      await service.cambiarEstado(id, { estado: 'rechazado', motivoRechazo: 'Fuera de alcance.' }, adminPeticion);

      await expect(
        service.cambiarEstado(id, { estado: 'aprobado', motivoRechazo: 'Reabierta por error.' }, adminPeticion),
      ).rejects.toThrow(BadRequestException);
    });

    it('responde 404 si la solicitud no existe', async () => {
      await expect(
        service.cambiarEstado(999, { estado: 'en_proceso' }, adminPeticion),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
