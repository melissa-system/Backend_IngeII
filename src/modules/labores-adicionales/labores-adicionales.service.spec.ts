import { LaboresAdicionalesService } from './labores-adicionales.service';
import { TipoActividad } from '../reportes-fontanero/entities/reporte-fontanero.enums';

// Prueba la labor que se genera al aprobar una solicitud (conexión de servicio
// o cambio de medidor): queda pendiente y sin fontanero, con los datos del
// abonado copiados, y no se duplica si la solicitud ya tenía una labor.

const datosSolicitud = {
  codigo_solicitud: 'SOL-MED-2026-1234',
  tipo_solicitud: 'cambio_medidor',
  abonado: {
    nombre: 'Ana Rojas',
    numero_abonado: 'ABN-0001',
    cedula: '1-1111-1111',
    telefono: '8888-8888',
  },
  direccion: 'Pueblo Nuevo, 200 m norte de la escuela',
  numero_nis: null,
};

function repositorioEnMemoria(filas: any[] = []) {
  let siguienteId = 1;
  return {
    filas,
    findOne: jest.fn(({ where } = {} as any) =>
      Promise.resolve(
        filas.find(
          (f) =>
            (where?.id === undefined || f.id === where.id) &&
            (where?.id_solicitud === undefined ||
              f.id_solicitud === where.id_solicitud),
        ) ?? null,
      ),
    ),
    findOneBy: jest.fn((where: any) =>
      Promise.resolve(
        filas.find((f) => Object.entries(where).every(([k, v]) => f[k] === v)) ??
          null,
      ),
    ),
    create: jest.fn((datos: any) => ({ ...datos })),
    save: jest.fn((fila: any) => {
      if (fila.id === undefined) fila.id = siguienteId++;
      filas.push(fila);
      return Promise.resolve(fila);
    }),
  };
}

describe('LaboresAdicionalesService — labor desde solicitud', () => {
  let service: LaboresAdicionalesService;
  let labores: ReturnType<typeof repositorioEnMemoria>;
  let empleados: ReturnType<typeof repositorioEnMemoria>;
  let usuarios: ReturnType<typeof repositorioEnMemoria>;
  let bitacoraService: any;

  beforeEach(() => {
    labores = repositorioEnMemoria();
    empleados = repositorioEnMemoria();
    usuarios = repositorioEnMemoria([{ id: 7, email: 'admin@asada.test' }]);
    bitacoraService = {
      registrarCreacion: jest.fn(() => Promise.resolve()),
    };

    service = new LaboresAdicionalesService(
      labores as any,
      empleados as any,
      usuarios as any,
      bitacoraService,
      // Sin solicitudes de material pendientes: no bloquea el inicio.
      { tienePendiente: jest.fn().mockResolvedValue(false) } as any,
    );
  });

  it('crea la labor pendiente, sin fontanero y con los datos del abonado', async () => {
    const labor = await service.crearDesdeSolicitud({
      idSolicitud: 15,
      tipoActividad: TipoActividad.MANTENIMIENTO,
      descripcion: 'Cambio de medidor por daño — Ana Rojas (ABN-0001).',
      datos: datosSolicitud,
      creadoPorId: 7,
    });

    expect(labor.id).toBeDefined();
    expect(labor.estado).toBe('Pendiente');
    expect(labor.origen).toBe('solicitud');
    expect(labor.id_solicitud).toBe(15);
    expect(labor.tipo_actividad).toBe(TipoActividad.MANTENIMIENTO);
    expect(labor.empleado).toBeNull();
    expect(labor.datos_solicitud).toEqual(datosSolicitud);
    expect(labor.codigo_labor).toMatch(/^LAB-\d{4}-\d{4}$/);

    expect(bitacoraService.registrarCreacion).toHaveBeenCalledWith(
      'labores_adicionales',
      labor.id,
      { id: 7, email: 'admin@asada.test' },
      expect.stringContaining('SOL-MED-2026-1234'),
    );
  });

  it('no duplica la labor si la solicitud ya tiene una', async () => {
    const existente = {
      id: 3,
      codigo_labor: 'LAB-2026-0003',
      estado: 'Pendiente',
      id_solicitud: 15,
      datos_solicitud: datosSolicitud,
    };
    labores.filas.push(existente);

    const labor = await service.crearDesdeSolicitud({
      idSolicitud: 15,
      tipoActividad: TipoActividad.MANTENIMIENTO,
      descripcion: 'Cambio de medidor por daño — Ana Rojas (ABN-0001).',
      datos: datosSolicitud,
      creadoPorId: 7,
    });

    expect(labor.id).toBe(3);
    expect(labores.save).not.toHaveBeenCalled();
    expect(bitacoraService.registrarCreacion).not.toHaveBeenCalled();
  });
});
