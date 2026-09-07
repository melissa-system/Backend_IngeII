import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { Documento } from './entities/documento.entity';
import { User } from '../auth/entities/user.entity';
import { CloudinaryService } from '../../config/cloudinary.service';
import {
  TipoDocumento,
  VisibilidadDocumento,
  EstadoDocumento,
} from './enums/documento.enums';

// Prueba el flujo completo del panel de documentos a nivel de servicio,
// simulando el repositorio de TypeORM y Cloudinary con mocks — así se
// puede correr sin conexión real a MySQL ni a la nube, y sin depender del
// backend levantado. Cubre: carga válida, búsqueda por tipo, nueva
// versión (con incremento automático), cambio de visibilidad e
// inhabilitación, y confirma que cada acción se refleja en lo que
// devuelven los métodos de consulta.

type DocumentoParcial = Partial<Documento> & { id: number };

function crearArchivoFalso(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'archivo',
    originalname: 'documento.pdf',
    mimetype: 'application/pdf',
    size: 1000,
    buffer: Buffer.from('contenido'),
    ...overrides,
  } as Express.Multer.File;
}

describe('DocumentosService', () => {
  let service: DocumentosService;
  let documentoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let userRepository: { findOneBy: jest.Mock };
  let cloudinaryService: {
    subirArchivo: jest.Mock;
    eliminarArchivo: jest.Mock;
  };

  // "Base de datos" en memoria muy simple: findOne/find filtran sobre este
  // arreglo según el `where` recibido, igual que haría MySQL.
  let filas: DocumentoParcial[];
  let siguienteId: number;

  function coincide(fila: DocumentoParcial, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([clave, valor]) => {
      if (valor && typeof valor === 'object' && '_type' in (valor as object)) {
        // Like(...) de TypeORM: para el mock alcanza con "incluye" el texto.
        const patron = String((valor as { _value: string })._value)
          .replace(/%/g, '');
        return String(fila[clave as keyof DocumentoParcial] ?? '')
          .toLowerCase()
          .includes(patron.toLowerCase());
      }
      return fila[clave as keyof DocumentoParcial] === valor;
    });
  }

  beforeEach(() => {
    filas = [];
    siguienteId = 1;

    documentoRepository = {
      find: jest.fn(({ where } = {}) => {
        if (!where) return Promise.resolve([...filas]);
        return Promise.resolve(filas.filter((f) => coincide(f, where)));
      }),
      findOne: jest.fn(({ where } = {}) => {
        const encontrado = filas.find((f) => coincide(f, where));
        return Promise.resolve(encontrado ?? null);
      }),
      findOneBy: jest.fn(({ id }: { id: number }) => {
        const encontrado = filas.find((f) => f.id === id);
        return Promise.resolve(encontrado ?? null);
      }),
      create: jest.fn((datos: Partial<Documento>) => ({ ...datos })),
      save: jest.fn((fila: DocumentoParcial) => {
        if (fila.id === undefined) {
          fila = { ...fila, id: siguienteId++ };
        }
        const idx = filas.findIndex((f) => f.id === fila.id);
        if (idx >= 0) {
          filas[idx] = { ...filas[idx], ...fila };
          return Promise.resolve(filas[idx]);
        }
        filas.push(fila);
        return Promise.resolve(fila);
      }),
      remove: jest.fn((fila: DocumentoParcial) => {
        filas = filas.filter((f) => f.id !== fila.id);
        return Promise.resolve(fila);
      }),
    };

    userRepository = {
      findOneBy: jest.fn(() => Promise.resolve({ id: 1, email: 'admin@test.com' })),
    };

    cloudinaryService = {
      subirArchivo: jest.fn(() =>
        Promise.resolve({ url: 'https://cloudinary.test/archivo.pdf', publicId: 'ASADA/documentos/abc' }),
      ),
      eliminarArchivo: jest.fn(() => Promise.resolve()),
    };

    service = new DocumentosService(
      documentoRepository as unknown as any,
      userRepository as unknown as any,
      cloudinaryService as unknown as CloudinaryService,
    );
  });

  // --- Carga de un archivo válido ---
  describe('create', () => {
    it('carga un documento válido como versión 1, vigente', async () => {
      const doc = await service.create(
        { nombre: 'Acta enero', tipo: TipoDocumento.ACTA, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
        1,
      );

      expect(doc.version).toBe(1);
      expect(doc.estado).toBe(EstadoDocumento.VIGENTE);
      expect(doc.nombre).toBe('Acta enero');
      expect(cloudinaryService.subirArchivo).toHaveBeenCalledTimes(1);

      // Se refleja en el listado administrativo
      const todos = await service.findAll();
      expect(todos).toHaveLength(1);
      expect(todos[0].nombre).toBe('Acta enero');
    });

    it('rechaza un tipo fuera del catálogo', async () => {
      await expect(
        service.create(
          { nombre: 'X', tipo: 'Tipo inventado' as TipoDocumento, visibilidad: VisibilidadDocumento.INTERNO },
          crearArchivoFalso(),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });

    it('rechaza si no viene archivo', async () => {
      await expect(
        service.create(
          { nombre: 'X', tipo: TipoDocumento.ACTA, visibilidad: VisibilidadDocumento.INTERNO },
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un nombre duplicado (ya exista vigente o inhabilitado)', async () => {
      await service.create(
        { nombre: 'Reglamento interno', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      cloudinaryService.subirArchivo.mockClear();

      await expect(
        service.create(
          { nombre: 'Reglamento interno', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
          crearArchivoFalso(),
        ),
      ).rejects.toThrow(BadRequestException);
      // No debe gastar cuota de Cloudinary si el nombre ya existía.
      expect(cloudinaryService.subirArchivo).not.toHaveBeenCalled();
    });
  });

  // --- Búsqueda por tipo ---
  describe('findAll con filtro por tipo', () => {
    beforeEach(async () => {
      await service.create(
        { nombre: 'Acta marzo', tipo: TipoDocumento.ACTA, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      await service.create(
        { nombre: 'Informe marzo', tipo: TipoDocumento.INFORME, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      await service.create(
        { nombre: 'Comunicado marzo', tipo: TipoDocumento.COMUNICADO, visibilidad: VisibilidadDocumento.PUBLICO },
        crearArchivoFalso(),
      );
    });

    it.each(Object.values(TipoDocumento))('filtra correctamente por tipo %s', async (tipo) => {
      const resultado = await service.findAll({ tipo });
      expect(resultado.every((d) => d.tipo === tipo)).toBe(true);
    });

    it('rechaza un filtro de tipo que no pertenece al catálogo', async () => {
      await expect(service.findAll({ tipo: 'No existe' })).rejects.toThrow(BadRequestException);
    });

    it('sin filtro devuelve todos', async () => {
      const resultado = await service.findAll();
      expect(resultado).toHaveLength(3);
    });

    it('busca por nombre parcial', async () => {
      const resultado = await service.findAll({ nombre: 'informe' });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nombre).toBe('Informe marzo');
    });
  });

  // --- Nueva versión ---
  describe('agregarNuevaVersion', () => {
    it('incrementa la versión, inhabilita la anterior y conserva nombre/tipo/visibilidad', async () => {
      const original = await service.create(
        { nombre: 'Medición cloro', tipo: TipoDocumento.MEDICION_ACUEDUCTO, visibilidad: VisibilidadDocumento.PUBLICO },
        crearArchivoFalso(),
      );

      const nuevaVersion = await service.agregarNuevaVersion(
        original.id,
        crearArchivoFalso({ originalname: 'medicion-v2.pdf' }),
        1,
      );

      expect(nuevaVersion.version).toBe(2);
      expect(nuevaVersion.estado).toBe(EstadoDocumento.VIGENTE);
      expect(nuevaVersion.nombre).toBe('Medición cloro');
      expect(nuevaVersion.tipo).toBe(TipoDocumento.MEDICION_ACUEDUCTO);
      expect(nuevaVersion.visibilidad).toBe(VisibilidadDocumento.PUBLICO);

      // Se refleja en el listado: dos filas, la vieja inhabilitada.
      const todos = await service.findAll();
      expect(todos).toHaveLength(2);
      const anterior = todos.find((d) => d.id === original.id)!;
      expect(anterior.estado).toBe(EstadoDocumento.INHABILITADO);
      expect(anterior.version).toBe(1);
    });

    it('rechaza si el documento no existe', async () => {
      await expect(
        service.agregarNuevaVersion(999, crearArchivoFalso()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si el documento ya está inhabilitado', async () => {
      const original = await service.create(
        { nombre: 'Doc viejo', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      await service.update(original.id, { estado: EstadoDocumento.INHABILITADO });

      await expect(
        service.agregarNuevaVersion(original.id, crearArchivoFalso()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si no viene archivo', async () => {
      const original = await service.create(
        { nombre: 'Doc sin archivo nuevo', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      await expect(
        service.agregarNuevaVersion(original.id, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- Visibilidad e inhabilitación ---
  describe('update (visibilidad y estado)', () => {
    it('cambia la visibilidad de Interno a Público', async () => {
      const doc = await service.create(
        { nombre: 'Horario atención', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );

      const actualizado = await service.update(doc.id, { visibilidad: VisibilidadDocumento.PUBLICO });
      expect(actualizado.visibilidad).toBe(VisibilidadDocumento.PUBLICO);

      // Se refleja en la consulta pública
      const publicos = await service.findPublicos();
      expect(publicos.map((d) => d.id)).toContain(doc.id);
    });

    it('inhabilita un documento y lo excluye de las consultas públicas y oficiales', async () => {
      const doc = await service.create(
        { nombre: 'Aviso corte de agua', tipo: TipoDocumento.COMUNICADO, visibilidad: VisibilidadDocumento.PUBLICO },
        crearArchivoFalso(),
      );

      // Antes de inhabilitar, aparece en ambas consultas.
      expect((await service.findPublicos()).map((d) => d.id)).toContain(doc.id);
      expect((await service.findOficiales()).map((d) => d.id)).toContain(doc.id);

      const inhabilitado = await service.update(doc.id, { estado: EstadoDocumento.INHABILITADO });
      expect(inhabilitado.estado).toBe(EstadoDocumento.INHABILITADO);

      // Después de inhabilitar, desaparece de ambas.
      expect((await service.findPublicos()).map((d) => d.id)).not.toContain(doc.id);
      expect((await service.findOficiales()).map((d) => d.id)).not.toContain(doc.id);

      // Pero sigue existiendo en el listado administrativo (se conserva el historial).
      expect((await service.findAll()).map((d) => d.id)).toContain(doc.id);
    });

    it('rechaza si el documento a actualizar no existe', async () => {
      await expect(
        service.update(999, { estado: EstadoDocumento.INHABILITADO }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un estado fuera del catálogo', async () => {
      const doc = await service.create(
        { nombre: 'Doc estado inválido', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      await expect(
        service.update(doc.id, { estado: 'Borrado' as EstadoDocumento }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza renombrar a un nombre que ya usa otro documento', async () => {
      await service.create(
        { nombre: 'Nombre A', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      const docB = await service.create(
        { nombre: 'Nombre B', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );

      await expect(
        service.update(docB.id, { nombre: 'Nombre A' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- findOficiales: solo vigentes, con o sin filtro de tipo ---
  describe('findOficiales', () => {
    it('excluye inhabilitados e incluye tanto Interno como Público', async () => {
      const interno = await service.create(
        { nombre: 'Doc interno', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.INTERNO },
        crearArchivoFalso(),
      );
      const publico = await service.create(
        { nombre: 'Doc público', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.PUBLICO },
        crearArchivoFalso(),
      );
      const inhabilitadoDoc = await service.create(
        { nombre: 'Doc inhabilitado', tipo: TipoDocumento.OTRO, visibilidad: VisibilidadDocumento.PUBLICO },
        crearArchivoFalso(),
      );
      await service.update(inhabilitadoDoc.id, { estado: EstadoDocumento.INHABILITADO });

      const oficiales = await service.findOficiales();
      const ids = oficiales.map((d) => d.id);
      expect(ids).toContain(interno.id);
      expect(ids).toContain(publico.id);
      expect(ids).not.toContain(inhabilitadoDoc.id);
    });
  });
});
