import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CambioRepresentanteService } from './solicitudes.cambio-representante.service';
import { CrearSolicitudCambioRepresentanteDto } from './dto/crear-solicitud-cambio-representante.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import { CloudinaryService } from '../../config/cloudinary.service';
import { MailService } from '../auth/mail.service';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudCambioRepresentante } from './entities/solicitud-cambio-representante.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { HistorialAbonado } from '../abonados/entities/historial-abonado.entity';

// Prueba el flujo completo de las solicitudes de cambio de representante legal
// a nivel de servicio, simulando los repositorios de TypeORM, Cloudinary y el
// correo con mocks — así se puede correr sin conexión real a MySQL ni a la
// nube. Cubre: creación válida (abonado y administrador), validaciones (solo
// jurídicas, cédula distinta, sin duplicados, abonado activo), rollback de
// Cloudinary si falla el guardado, resolución aprobado (que actualiza el
// historial y los datos del abonado jurídico) y rechazo (solo motivo).

type SolicitudParcial = Partial<Solicitud> & { id: number };
type DetalleParcial = Partial<SolicitudCambioRepresentante> & { id: number };

function crearCedulaFalsa(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'copiaCedula',
    originalname: 'cedula.jpg',
    mimetype: 'image/jpeg',
    size: 1000,
    buffer: Buffer.from('contenido'),
    ...overrides,
  } as Express.Multer.File;
}

// "Base de datos" en memoria muy simple: find/findOne filtran sobre estos
// arreglos según el `where` recibido, igual que haría MySQL. Soporta
// operadores In(...) y filtros sobre relaciones anidadas (abonado.id,
// usuario.id, solicitud.id).
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

describe('CambioRepresentanteService', () => {
  let service: CambioRepresentanteService;

  let solicitudRepository: any;
  let detalleRepository: any;
  let abonadoRepository: any;
  let empleadoRepository: any;
  let userRepository: any;
  let historialRepository: any;
  let cloudinaryService: any;
  let mailService: any;

  // Datos semilla.
  let abonados: any[];
  let solicitudes: SolicitudParcial[];
  let detalles: DetalleParcial[];
  let siguienteSolicitudId: number;
  let siguienteDetalleId: number;

  // Referencias mutables al abonado "activo" que se clonan en cada test.
  let abonadoJuridico: any;
  let abonadoFisico: any;
  let abonadoJuridicoInactivo: any;

  const abonadosJuridicoSemilla = {
    id: 1,
    numero_abonado: 'ABN-0001',
    nombre: 'Comercio Don Pepe S.A.',
    cedula: '3-101-222222',
    correo: 'comercio@asada.test',
    estado: 'Activo',
    tipo_abonado: 'Jurídica',
    usuario: { id: 5 },
    juridico: {
      nombre_representante_legal: 'Ana Martínez',
      cedula_representante: '1-2345-6789',
      representante_direccion: null,
      representante_correo: null,
    },
  };
  const abonadosFisicoSemilla = {
    id: 2,
    numero_abonado: 'ABN-0002',
    nombre: 'Pedro Pérez',
    cedula: '1-1234-5678',
    correo: 'pedro@asada.test',
    estado: 'Activo',
    tipo_abonado: 'Física',
    usuario: { id: 6 },
  };
  const abonadosJuridicoInactivoSemilla = {
    id: 3,
    numero_abonado: 'ABN-0003',
    nombre: 'Ferretería La Tuerca S.A.',
    cedula: '3-101-333333',
    correo: 'ferreteria@asada.test',
    estado: 'Inactivo',
    tipo_abonado: 'Jurídica',
    usuario: { id: 8 },
    juridico: {
      nombre_representante_legal: 'Luis Vargas',
      cedula_representante: '1-1111-2222',
      representante_direccion: 'Cartago',
      representante_correo: 'luis@ferreteria.test',
    },
  };

  const empleado = { id: 3, nombre: 'Admin ASADA', usuario: { id: 7 } };
  const usuarioAbonado = { id: 5, email: 'comercio@asada.test' };
  const usuarioAdmin = { id: 7, email: 'admin@asada.test' };

  const usuarioAbonadoPeticion = { id: 5, role: 'abonado' } as any;
  const usuarioAdminPeticion = { id: 7, role: 'admin' } as any;

  beforeEach(() => {
    // Clonar los objetos semilla: los tests que aprueban una solicitud mutan
    // el abonado jurídico, y no queremos que ese cambio se filtre a otros tests.
    const clonar = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;
    abonadoJuridico = clonar(abonadosJuridicoSemilla);
    abonadoFisico = clonar(abonadosFisicoSemilla);
    abonadoJuridicoInactivo = clonar(abonadosJuridicoInactivoSemilla);
    abonados = [abonadoJuridico, abonadoFisico, abonadoJuridicoInactivo];
    solicitudes = [];
    detalles = [];
    siguienteSolicitudId = 1;
    siguienteDetalleId = 1;

    solicitudRepository = {
      findOne: jest.fn(({ where } = {}) => {
        if (!where) return Promise.resolve(solicitudes[0] ?? null);
        return Promise.resolve(solicitudes.find((s) => coincide(s, where)) ?? null);
      }),
      findOneBy: jest.fn((where: Record<string, any>) => {
        return Promise.resolve(solicitudes.find((s) => coincide(s, where)) ?? null);
      }),
      find: jest.fn(({ where } = {}) => {
        if (!where) return Promise.resolve([...solicitudes]);
        return Promise.resolve(solicitudes.filter((s) => coincide(s, where)));
      }),
      create: jest.fn((datos: Partial<Solicitud>) => ({ ...datos })),
      save: jest.fn((fila: SolicitudParcial) => {
        if (fila.id === undefined) fila.id = siguienteSolicitudId++;
        const idx = solicitudes.findIndex((s) => s.id === fila.id);
        if (idx >= 0) {
          solicitudes[idx] = { ...solicitudes[idx], ...fila };
          return Promise.resolve(solicitudes[idx]);
        }
        solicitudes.push(fila);
        return Promise.resolve(fila);
      }),
    };

    detalleRepository = {
      findOneBy: jest.fn((where: Record<string, any>) => {
        return Promise.resolve(detalles.find((d) => coincide(d, where)) ?? null);
      }),
      find: jest.fn(({ where } = {}) => {
        if (!where) return Promise.resolve([...detalles]);
        return Promise.resolve(detalles.filter((d) => coincide(d, where)));
      }),
      create: jest.fn((datos: Partial<SolicitudCambioRepresentante>) => ({ ...datos })),
      save: jest.fn((fila: DetalleParcial) => {
        if (fila.id === undefined) fila.id = siguienteDetalleId++;
        const idx = detalles.findIndex((d) => d.id === fila.id);
        if (idx >= 0) {
          detalles[idx] = { ...detalles[idx], ...fila };
          return Promise.resolve(detalles[idx]);
        }
        detalles.push(fila);
        return Promise.resolve(fila);
      }),
    };

    abonadoRepository = {
      findOne: jest.fn(({ where } = {}) => {
        return Promise.resolve(abonados.find((a) => coincide(a, where)) ?? null);
      }),
      save: jest.fn((fila: any) => {
        const idx = abonados.findIndex((a) => a.id === fila.id);
        if (idx >= 0) {
          abonados[idx] = { ...abonados[idx], ...fila };
          return Promise.resolve(abonados[idx]);
        }
        abonados.push(fila);
        return Promise.resolve(fila);
      }),
    };

    empleadoRepository = {
      findOne: jest.fn(() => Promise.resolve(empleado)),
    };

    userRepository = {
      findOneBy: jest.fn(({ id }: { id: number }) =>
        Promise.resolve(id === 5 ? usuarioAbonado : usuarioAdmin),
      ),
    };

    historialRepository = {
      create: jest.fn((datos: Partial<HistorialAbonado>) => ({ ...datos })),
      save: jest.fn((filas: any[]) => Promise.resolve(filas)),
    };

    cloudinaryService = {
      subirArchivo: jest.fn(() =>
        Promise.resolve({
          url: 'https://cloudinary.test/cedula.jpg',
          publicId: 'solicitudes/cambio-representante/abc',
        }),
      ),
      eliminarArchivo: jest.fn(() => Promise.resolve()),
    };

    mailService = {
      enviarCorreoResultadoCambioRepresentante: jest.fn(() => Promise.resolve()),
    };

    service = new CambioRepresentanteService(
      solicitudRepository as unknown as any,
      detalleRepository as unknown as any,
      abonadoRepository as unknown as any,
      empleadoRepository as unknown as any,
      userRepository as unknown as any,
      historialRepository as unknown as any,
      cloudinaryService as unknown as CloudinaryService,
      mailService as unknown as MailService,
    );
  });

  // --- Creación ---
  describe('crear', () => {
    const dtoBase: CrearSolicitudCambioRepresentanteDto = {
      representanteNuevoNombre: 'María Jiménez',
      representanteNuevoCedula: '1-9876-5432',
      representanteNuevoDireccion: 'Heredia, San Pablo',
      representanteNuevoCorreo: 'maria@nuevo.test',
      justificacion: 'Falleció el representante anterior',
    };

    it('crea una solicitud pendiente para el abonado logueado y copia al representante actual', async () => {
      const creada = await service.crear(dtoBase, crearCedulaFalsa(), usuarioAbonadoPeticion);

      expect(creada.estado).toBe('pendiente');
      expect(creada.tipo_solicitud).toBe('cambio_representante');
      expect(creada.codigo_solicitud).toMatch(/^SOL-REP-\d{4}-\d{4}$/);
      expect(creada.id_abonado).toBe(1);
      // El representante anterior se copia automáticamente del abonado.
      expect(creada.representante_anterior_nombre).toBe('Ana Martínez');
      expect(creada.representante_anterior_cedula).toBe('1-2345-6789');
      expect(creada.representante_nuevo_nombre).toBe('María Jiménez');
      expect(creada.representante_nuevo_cedula).toBe('1-9876-5432');
      expect(creada.representante_nuevo_direccion).toBe('Heredia, San Pablo');
      expect(creada.representante_nuevo_correo).toBe('maria@nuevo.test');
      expect(creada.copia_cedula_url).toBe('https://cloudinary.test/cedula.jpg');
      // Para el abonado no se asocia un empleado.
      expect(creada.id_empleado).toBeNull();
      expect(cloudinaryService.subirArchivo).toHaveBeenCalledTimes(1);
    });

    it('permite crear sin correo del nuevo representante', async () => {
      const creada = await service.crear(
        { ...dtoBase, representanteNuevoCorreo: undefined },
        crearCedulaFalsa(),
        usuarioAbonadoPeticion,
      );
      expect(creada.representante_nuevo_correo).toBeNull();
    });

    it('administrador crea la solicitud para un abonado elegido y queda asociado el empleado', async () => {
      const creada = await service.crear(
        { ...dtoBase, idAbonado: 1 },
        crearCedulaFalsa(),
        usuarioAdminPeticion,
      );
      expect(creada.id_abonado).toBe(1);
      expect(creada.id_empleado).toBe(3);
    });

    it('rechaza si el abonado está inactivo', async () => {
      await expect(
        service.crear({ ...dtoBase, idAbonado: 3 }, crearCedulaFalsa(), usuarioAdminPeticion),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('rechaza si el abonado no es jurídico', async () => {
      await expect(
        service.crear({ ...dtoBase, idAbonado: 2 }, crearCedulaFalsa(), usuarioAdminPeticion),
      ).rejects.toThrow('Solo los abonados jurídicos');
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('rechaza si la cédula del nuevo representante es la misma del actual', async () => {
      await expect(
        service.crear(
          { ...dtoBase, representanteNuevoCedula: '1-2345-6789' },
          crearCedulaFalsa(),
          usuarioAbonadoPeticion,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si ya existe una solicitud abierta para el mismo abonado', async () => {
      // Una solicitud pendiente previa del mismo abonado.
      const previa = solicitudRepository.create({
        id: 99,
        codigo_solicitud: 'SOL-REP-2026-1111',
        abonado: abonadoJuridico,
        tipo_solicitud: 'cambio_representante',
        estado: 'pendiente',
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date(),
      });
      await solicitudRepository.save(previa);
      const detallePrevio = detalleRepository.create({
        solicitud: previa,
        representante_anterior_nombre: 'Ana Martínez',
        representante_anterior_cedula: '1-2345-6789',
        representante_nuevo_nombre: 'X',
        representante_nuevo_cedula: '1-9999-9999',
        representante_nuevo_direccion: 'X',
        justificacion: 'X',
      });
      await detalleRepository.save(detallePrevio);

      await expect(
        service.crear(dtoBase, crearCedulaFalsa(), usuarioAbonadoPeticion),
      ).rejects.toThrow(/SOL-REP-2026-1111/);
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('no deja la cédula huérfana en Cloudinary si falla el guardado en BD', async () => {
      detalleRepository.save.mockRejectedValueOnce(new Error('fallo BD'));

      await expect(
        service.crear(dtoBase, crearCedulaFalsa(), usuarioAbonadoPeticion),
      ).rejects.toThrow('fallo BD');

      expect(cloudinaryService.subirArchivo).toHaveBeenCalledTimes(1);
      expect(cloudinaryService.eliminarArchivo).toHaveBeenCalledWith(
        'solicitudes/cambio-representante/abc',
        true,
      );
    });
  });

  // --- Listado ---
  describe('listar', () => {
    async function crearSolicitud(
      abonado: any,
      nuevoNombre: string,
    ): Promise<void> {
      const sol = solicitudRepository.create({
        codigo_solicitud: `SOL-REP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        abonado,
        tipo_solicitud: 'cambio_representante',
        estado: 'pendiente',
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date(),
      });
      await solicitudRepository.save(sol);
      await detalleRepository.save(
        detalleRepository.create({
          solicitud: sol,
          representante_anterior_nombre: abonado.juridico?.nombre_representante_legal ?? '',
          representante_anterior_cedula: abonado.juridico?.cedula_representante ?? '',
          representante_nuevo_nombre: nuevoNombre,
          representante_nuevo_cedula: '1-0000-0000',
          representante_nuevo_direccion: 'San José',
          justificacion: 'Motivo de prueba',
        }),
      );
    }

    it('un abonado solo ve sus propias solicitudes', async () => {
      await crearSolicitud(abonadoJuridico, 'María A');
      await crearSolicitud(abonadoJuridicoInactivo, 'Carlos B');

      const resultado = await service.listar(usuarioAbonadoPeticion);
      expect(resultado).toHaveLength(1);
      expect(resultado[0].id_abonado).toBe(1);
      expect(resultado[0].representante_nuevo_nombre).toBe('María A');
    });

    it('el administrador ve todas las solicitudes', async () => {
      await crearSolicitud(abonadoJuridico, 'María A');
      await crearSolicitud(abonadoJuridicoInactivo, 'Carlos B');

      const resultado = await service.listar(usuarioAdminPeticion);
      expect(resultado).toHaveLength(2);
    });

    it('devuelve lista vacía si el abonado no tiene solicitudes', async () => {
      const resultado = await service.listar(usuarioAbonadoPeticion);
      expect(resultado).toEqual([]);
    });
  });

  // --- Cambio de estado ---
  describe('cambiarEstado', () => {
    async function crearSolicitudAbierta(
      estado: 'pendiente' | 'en_proceso' = 'pendiente',
    ): Promise<number> {
      const sol = solicitudRepository.create({
        codigo_solicitud: 'SOL-REP-2026-5555',
        abonado: abonadoJuridico,
        tipo_solicitud: 'cambio_representante',
        estado,
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date(),
      });
      const guardada = await solicitudRepository.save(sol);
      const detalle = {
        solicitud: guardada,
        representante_anterior_nombre: 'Ana Martínez',
        representante_anterior_cedula: '1-2345-6789',
        representante_nuevo_nombre: 'María Jiménez',
        representante_nuevo_cedula: '1-9876-5432',
        representante_nuevo_direccion: 'Heredia, San Pablo',
        representante_nuevo_correo: 'maria@nuevo.test',
        justificacion: 'Motivo de prueba',
        copia_cedula_url: 'https://cloudinary.test/cedula.jpg',
      };
      await detalleRepository.save(detalleRepository.create(detalle));
      return guardada.id;
    }

    it('rechaza si la solicitud no existe', async () => {
      await expect(
        service.cambiarEstado(
          999,
          { estado: 'aprobado' },
          usuarioAdminPeticion,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('marca en proceso sin tocar los datos del abonado ni enviar correo', async () => {
      const id = await crearSolicitudAbierta();

      const actualizada = await service.cambiarEstado(
        id,
        { estado: 'en_proceso' },
        usuarioAdminPeticion,
      );

      expect(actualizada.estado).toBe('en_proceso');
      expect(actualizada.id_empleado).toBe(3);
      expect(abonadoJuridico.juridico.nombre_representante_legal).toBe('Ana Martínez');
      expect(mailService.enviarCorreoResultadoCambioRepresentante).not.toHaveBeenCalled();
    });

    it('aprobado actualiza los datos del representante legal y registra el historial', async () => {
      const id = await crearSolicitudAbierta();

      const actualizada = await service.cambiarEstado(
        id,
        { estado: 'aprobado' },
        usuarioAdminPeticion,
      );

      expect(actualizada.estado).toBe('aprobado');
      // El abonado jurídico adoptó los datos del nuevo representante.
      expect(abonadoJuridico.juridico.nombre_representante_legal).toBe('María Jiménez');
      expect(abonadoJuridico.juridico.cedula_representante).toBe('1-9876-5432');
      expect(abonadoJuridico.juridico.representante_direccion).toBe('Heredia, San Pablo');
      expect(abonadoJuridico.juridico.representante_correo).toBe('maria@nuevo.test');

      // 4 cambios registrados en el historial del abonado.
      expect(historialRepository.save).toHaveBeenCalledTimes(1);
      const cambios: any[] = historialRepository.save.mock.calls[0][0];
      expect(cambios).toHaveLength(4);
      expect(cambios.map((c) => c.campo)).toEqual([
        'nombre_representante_legal',
        'cedula_representante',
        'representante_direccion',
        'representante_correo',
      ]);
      expect(cambios[0].valor_anterior).toBe('Ana Martínez');
      expect(cambios[0].valor_nuevo).toBe('María Jiménez');

      // Se notifica al correo del abonado y al del nuevo representante.
      expect(mailService.enviarCorreoResultadoCambioRepresentante).toHaveBeenCalledWith(
        'comercio@asada.test',
        'maria@nuevo.test',
        expect.objectContaining({
          codigo: 'SOL-REP-2026-5555',
          estadoResultado: 'aprobado',
          nombreNuevoRepresentante: 'María Jiménez',
        }),
      );
    });

    it('rechazado guarda el motivo y no modifica los datos del abonado', async () => {
      const id = await crearSolicitudAbierta();

      const actualizada = await service.cambiarEstado(
        id,
        { estado: 'rechazado', motivoRechazo: 'La cédula adjunta no coincide' },
        usuarioAdminPeticion,
      );

      expect(actualizada.estado).toBe('rechazado');
      expect(actualizada.motivo_rechazo).toBe('La cédula adjunta no coincide');
      expect(abonadoJuridico.juridico.nombre_representante_legal).toBe('Ana Martínez');
      expect(historialRepository.save).not.toHaveBeenCalled();
      expect(mailService.enviarCorreoResultadoCambioRepresentante).toHaveBeenCalledWith(
        'comercio@asada.test',
        'maria@nuevo.test',
        expect.objectContaining({
          estadoResultado: 'rechazado',
          motivo: 'La cédula adjunta no coincide',
        }),
      );
    });

    it('rechaza cambiar una solicitud ya cerrada', async () => {
      const id = await crearSolicitudAbierta();
      await service.cambiarEstado(id, { estado: 'aprobado' }, usuarioAdminPeticion);

      await expect(
        service.cambiarEstado(id, { estado: 'rechazado' }, usuarioAdminPeticion),
      ).rejects.toThrow(BadRequestException);
    });

    it('un fallo de SMTP no tumba la resolución de la solicitud', async () => {
      const id = await crearSolicitudAbierta();
      mailService.enviarCorreoResultadoCambioRepresentante.mockRejectedValueOnce(
        new Error('smtp caído'),
      );

      const actualizada = await service.cambiarEstado(
        id,
        { estado: 'rechazado', motivoRechazo: 'Documentación incompleta' },
        usuarioAdminPeticion,
      );
      expect(actualizada.estado).toBe('rechazado');
      expect(actualizada.motivo_rechazo).toBe('Documentación incompleta');
    });
  });
});