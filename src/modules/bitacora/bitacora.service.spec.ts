import { BitacoraService } from './bitacora.service';
import { ModuloBitacora, AccionBitacora } from './entities/bitacora.enums';

// Prueba el servicio central de auditoría, que usan todos los módulos del
// sistema. El repositorio de TypeORM se simula con mocks, así que se corre
// sin conexión a MySQL.
//
// Lo más importante que se verifica:
//  - registrar() NUNCA lanza excepción: si la auditoría falla, la operación
//    real (aprobar una solicitud, editar un abonado...) no debe caerse.
//  - compararCampos() solo reporta lo que realmente cambió.
//  - los filtros por fecha incluyen el día completo en HORA DE COSTA RICA.

describe('BitacoraService', () => {
  let service: BitacoraService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    find: jest.Mock;
  };

  const autor = { id: 7, email: 'admin@asada.test' };

  beforeEach(() => {
    repo = {
      create: jest.fn((datos) => ({ ...datos })),
      save: jest.fn((fila) => Promise.resolve({ id: 1, ...fila })),
      findAndCount: jest.fn(() => Promise.resolve([[], 0])),
      find: jest.fn(() => Promise.resolve([])),
    };
    service = new BitacoraService(repo as unknown as any);
    // Silenciar los logs de error esperados en las pruebas de fallo.
    (service as any).logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  });

  // --- Escritura ---
  describe('registrar', () => {
    it('guarda el movimiento con el autor y los valores recibidos', async () => {
      await service.registrar({
        modulo: ModuloBitacora.ABONADOS,
        registro_id: 12,
        accion: AccionBitacora.EDICION,
        autor,
        campo: 'telefono',
        valor_anterior: '8888-1111',
        valor_nuevo: '8888-2222',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledWith({
        modulo: 'abonados',
        registro_id: 12,
        accion: 'edicion',
        usuario: { id: 7 },
        usuario_email: 'admin@asada.test',
        campo: 'telefono',
        valor_anterior: '8888-1111',
        valor_nuevo: '8888-2222',
        observaciones: null,
      });
    });

    it('sin usuario autenticado (formulario público) deja la relación vacía pero conserva el correo', async () => {
      await service.registrar({
        modulo: ModuloBitacora.SOLICITUDES,
        registro_id: 3,
        accion: AccionBitacora.CREACION,
        autor: { id: null, email: 'vecino@correo.test' },
      });

      const guardado = repo.create.mock.calls[0][0];
      expect(guardado.usuario).toBeNull();
      expect(guardado.usuario_email).toBe('vecino@correo.test');
    });

    it('si la base de datos falla NO lanza excepción y deja constancia en el log', async () => {
      repo.save.mockImplementationOnce(() => Promise.reject(new Error('MySQL caído')));

      await expect(
        service.registrar({
          modulo: ModuloBitacora.SOLICITUDES,
          registro_id: 9,
          accion: AccionBitacora.CAMBIO_ESTADO,
          autor,
        }),
      ).resolves.toBeUndefined();

      expect((service as any).logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('atajos de registro', () => {
    it('registrarEdicion guarda UNA fila por cada campo cambiado', async () => {
      await service.registrarEdicion(ModuloBitacora.EMPLEADOS, 4, autor, [
        { campo: 'puesto', valor_anterior: 'Fontanero', valor_nuevo: 'Administrador' },
        { campo: 'telefono', valor_anterior: null, valor_nuevo: '8888-3333' },
      ]);

      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(repo.create.mock.calls.map((c) => c[0].campo)).toEqual(['puesto', 'telefono']);
    });

    it('registrarEdicion sin cambios no escribe nada', async () => {
      await service.registrarEdicion(ModuloBitacora.EMPLEADOS, 4, autor, []);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('registrarCambioEstado usa la acción cambio_estado y el campo "estado"', async () => {
      await service.registrarCambioEstado(
        ModuloBitacora.SOLICITUDES, 5, autor, 'pendiente', 'rechazado', 'Falta documentación',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'cambio_estado',
          campo: 'estado',
          valor_anterior: 'pendiente',
          valor_nuevo: 'rechazado',
          observaciones: 'Falta documentación',
        }),
      );
    });

    it('registrarCreacion y registrarEliminacion usan su acción correspondiente', async () => {
      await service.registrarCreacion(ModuloBitacora.DOCUMENTOS, 1, autor, 'Subido');
      await service.registrarEliminacion(ModuloBitacora.DOCUMENTOS, 1, autor, 'Borrado');

      expect(repo.create.mock.calls.map((c) => c[0].accion)).toEqual(['creacion', 'eliminacion']);
    });
  });

  // --- Comparación de campos ---
  describe('compararCampos', () => {
    const campos = ['nombre', 'telefono', 'correo'];

    it('reporta solo los campos cuyo valor cambió', () => {
      const cambios = BitacoraService.compararCampos(
        { nombre: 'Ana', telefono: '8888-1111', correo: 'ana@x.test' },
        { nombre: 'Ana', telefono: '8888-2222', correo: 'ana@x.test' },
        campos,
      );
      expect(cambios).toEqual([
        { campo: 'telefono', valor_anterior: '8888-1111', valor_nuevo: '8888-2222' },
      ]);
    });

    it('ignora los campos que no vienen en el PATCH (undefined)', () => {
      expect(
        BitacoraService.compararCampos({ nombre: 'Ana' }, { telefono: undefined }, campos),
      ).toEqual([]);
    });

    it('ignora los campos que no están en la lista a auditar', () => {
      expect(
        BitacoraService.compararCampos({ password: 'a' }, { password: 'b' }, campos),
      ).toEqual([]);
    });

    it('un número y su texto equivalente no cuentan como cambio', () => {
      expect(
        BitacoraService.compararCampos({ nombre: 5 }, { nombre: '5' }, campos),
      ).toEqual([]);
    });

    it('registra el paso de un valor a vacío (null)', () => {
      expect(
        BitacoraService.compararCampos({ correo: 'ana@x.test' }, { correo: null }, campos),
      ).toEqual([{ campo: 'correo', valor_anterior: 'ana@x.test', valor_nuevo: null }]);
    });
  });

  // --- Lectura ---
  describe('buscar', () => {
    function whereUsado() {
      return repo.findAndCount.mock.calls[0][0].where;
    }

    it('sin filtros consulta todo, ordenado del más reciente al más viejo', async () => {
      await service.buscar({});
      const opciones = repo.findAndCount.mock.calls[0][0];
      expect(opciones.where).toEqual({});
      expect(opciones.order).toEqual({ fecha: 'DESC' });
    });

    it('aplica los filtros de módulo, acción, registro y usuario', async () => {
      await service.buscar({
        modulo: ModuloBitacora.AVERIAS,
        accion: AccionBitacora.CAMBIO_ESTADO,
        registro_id: 8,
        usuario_id: 7,
      });
      expect(whereUsado()).toEqual({
        modulo: 'averias',
        accion: 'cambio_estado',
        registro_id: 8,
        usuario: { id: 7 },
      });
    });

    it('pagina correctamente (página 3 de 25 salta los primeros 50)', async () => {
      await service.buscar({ pagina: 3, limite: 25 });
      const opciones = repo.findAndCount.mock.calls[0][0];
      expect(opciones.skip).toBe(50);
      expect(opciones.take).toBe(25);
    });

    it('nunca devuelve más de 200 filas por página aunque se pidan más', async () => {
      const r = await service.buscar({ limite: 5000 });
      expect(repo.findAndCount.mock.calls[0][0].take).toBe(200);
      expect(r.limite).toBe(200);
    });

    // La ASADA opera en hora de Costa Rica (UTC-6, sin horario de verano).
    // Un movimiento hecho el 15/09 a las 7:50 p. m. en Costa Rica queda
    // guardado como 16/09 01:50 en UTC, pero para quien usa el sistema
    // ocurrió el 15/09 y tiene que aparecer al filtrar ese día.
    const nochePlazaCR = new Date('2026-09-15T19:50:00-06:00');
    const madrugadaCR = new Date('2026-09-15T00:10:00-06:00');

    function incluye(operador: any, fecha: Date): boolean {
      const [desde, hasta] =
        operador._type === 'between'
          ? operador._value
          : operador._type === 'moreThanOrEqual'
            ? [operador._value, new Date(8640000000000000)]
            : [new Date(-8640000000000000), operador._value];
      return fecha >= desde && fecha <= hasta;
    }

    it('"hasta" incluye lo ocurrido por la noche de ese día en hora de Costa Rica', async () => {
      await service.buscar({ hasta: '2026-09-15' });
      expect(incluye(whereUsado().fecha, nochePlazaCR)).toBe(true);
    });

    it('"desde" incluye lo ocurrido de madrugada ese día en hora de Costa Rica', async () => {
      await service.buscar({ desde: '2026-09-15' });
      expect(incluye(whereUsado().fecha, madrugadaCR)).toBe(true);
    });

    it('filtrar un solo día (desde = hasta) abarca ese día completo en Costa Rica', async () => {
      await service.buscar({ desde: '2026-09-15', hasta: '2026-09-15' });
      const fecha = whereUsado().fecha;
      expect(incluye(fecha, madrugadaCR)).toBe(true);
      expect(incluye(fecha, nochePlazaCR)).toBe(true);
      // Y NO incluye la noche anterior (14/09 en Costa Rica).
      expect(incluye(fecha, new Date('2026-09-14T22:00:00-06:00'))).toBe(false);
    });
  });

  describe('historialDeRegistro', () => {
    it('consulta los movimientos de un registro concreto, del más reciente al más viejo', async () => {
      await service.historialDeRegistro(ModuloBitacora.ABONADOS, 12);
      expect(repo.find).toHaveBeenCalledWith({
        where: { modulo: 'abonados', registro_id: 12 },
        relations: { usuario: true },
        order: { fecha: 'DESC' },
      });
    });
  });
});
