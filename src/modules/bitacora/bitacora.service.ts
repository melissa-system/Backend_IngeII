import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Bitacora } from './entities/bitacora.entity';
import { ModuloBitacora, AccionBitacora } from './entities/bitacora.enums';
import { FiltrarBitacoraDto } from './dto/filtrar-bitacora.dto';

// Datos de quien ejecuta la acción. Se acepta el email aparte del id porque
// la bitácora conserva el correo aunque después se elimine la cuenta.
export interface AutorMovimiento {
  id: number | null;
  email: string | null;
}

// Un campo que cambió, ya convertido a texto.
export interface CambioCampo {
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
}

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

@Injectable()
export class BitacoraService {
  private readonly logger = new Logger(BitacoraService.name);

  constructor(
    @InjectRepository(Bitacora)
    private readonly bitacoraRepository: Repository<Bitacora>,
  ) {}

  // ------------------------------------------------------------------
  // ESCRITURA
  //
  // Todos los métodos de registro son TOLERANTES A FALLOS: si el guardado
  // en bitácora falla, se registra el error en los logs pero NO se lanza
  // excepción. La auditoría no puede tumbar la operación real — si alguien
  // aprueba una solicitud y la bitácora está caída, la solicitud igual
  // debe aprobarse. Mismo criterio que ya se usa con el envío de correos.
  // ------------------------------------------------------------------

  // Registro genérico. Los métodos de abajo son atajos sobre este.
  async registrar(datos: {
    modulo: ModuloBitacora;
    registro_id: number;
    accion: AccionBitacora;
    autor: AutorMovimiento;
    campo?: string | null;
    valor_anterior?: string | null;
    valor_nuevo?: string | null;
    observaciones?: string | null;
  }): Promise<void> {
    try {
      await this.bitacoraRepository.save(
        this.bitacoraRepository.create({
          modulo: datos.modulo,
          registro_id: datos.registro_id,
          accion: datos.accion,
          usuario: datos.autor.id ? ({ id: datos.autor.id } as never) : null,
          usuario_email: datos.autor.email ?? null,
          campo: datos.campo ?? null,
          valor_anterior: datos.valor_anterior ?? null,
          valor_nuevo: datos.valor_nuevo ?? null,
          observaciones: datos.observaciones ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar en bitácora: ${datos.modulo}#${datos.registro_id} (${datos.accion})`,
        error as Error,
      );
    }
  }

  async registrarCreacion(
    modulo: ModuloBitacora,
    registroId: number,
    autor: AutorMovimiento,
    observaciones?: string,
  ): Promise<void> {
    await this.registrar({
      modulo,
      registro_id: registroId,
      accion: AccionBitacora.CREACION,
      autor,
      observaciones,
    });
  }

  // Registra una edición por cada campo modificado, igual que hacía
  // historial_abonados. Si no cambió nada, no escribe nada.
  async registrarEdicion(
    modulo: ModuloBitacora,
    registroId: number,
    autor: AutorMovimiento,
    cambios: CambioCampo[],
  ): Promise<void> {
    for (const cambio of cambios) {
      await this.registrar({
        modulo,
        registro_id: registroId,
        accion: AccionBitacora.EDICION,
        autor,
        campo: cambio.campo,
        valor_anterior: cambio.valor_anterior,
        valor_nuevo: cambio.valor_nuevo,
      });
    }
  }

  async registrarCambioEstado(
    modulo: ModuloBitacora,
    registroId: number,
    autor: AutorMovimiento,
    estadoAnterior: string | null,
    estadoNuevo: string,
    observaciones?: string,
  ): Promise<void> {
    await this.registrar({
      modulo,
      registro_id: registroId,
      accion: AccionBitacora.CAMBIO_ESTADO,
      autor,
      campo: 'estado',
      valor_anterior: estadoAnterior,
      valor_nuevo: estadoNuevo,
      observaciones,
    });
  }

  async registrarEliminacion(
    modulo: ModuloBitacora,
    registroId: number,
    autor: AutorMovimiento,
    observaciones?: string,
  ): Promise<void> {
    await this.registrar({
      modulo,
      registro_id: registroId,
      accion: AccionBitacora.ELIMINACION,
      autor,
      observaciones,
    });
  }

  // Utilidad para los módulos que necesitan comparar un objeto antes y
  // después de un PATCH y sacar la lista de campos que realmente cambiaron.
  // Evita que cada módulo reimplemente esa comparación a su manera.
  static compararCampos(
    antes: Record<string, unknown>,
    despues: Record<string, unknown>,
    camposAuditar: string[],
  ): CambioCampo[] {
    const cambios: CambioCampo[] = [];

    for (const campo of camposAuditar) {
      const anterior = antes[campo];
      const nuevo = despues[campo];

      // Se omiten los campos que no vienen en el PATCH (undefined): no
      // cambiaron, simplemente no se enviaron.
      if (nuevo === undefined) continue;
      if (String(anterior ?? '') === String(nuevo ?? '')) continue;

      cambios.push({
        campo,
        valor_anterior: anterior === null || anterior === undefined ? null : String(anterior),
        valor_nuevo: nuevo === null ? null : String(nuevo),
      });
    }

    return cambios;
  }

  // ------------------------------------------------------------------
  // LECTURA
  // ------------------------------------------------------------------

  async buscar(filtros: FiltrarBitacoraDto): Promise<{
    datos: Bitacora[];
    total: number;
    pagina: number;
    limite: number;
  }> {
    const pagina = filtros.pagina ?? 1;
    const limite = Math.min(filtros.limite ?? LIMITE_POR_DEFECTO, LIMITE_MAXIMO);

    const where: Record<string, unknown> = {};

    if (filtros.modulo) where.modulo = filtros.modulo;
    if (filtros.registro_id) where.registro_id = filtros.registro_id;
    if (filtros.accion) where.accion = filtros.accion;
    if (filtros.usuario_id) where.usuario = { id: filtros.usuario_id };

    // El filtro por fecha incluye ambos días completos: 'desde' arranca a
    // las 00:00 y 'hasta' termina a las 23:59:59. Sin ese ajuste, filtrar
    // "hasta hoy" dejaría fuera todo lo que pasó hoy después de medianoche.
    if (filtros.desde && filtros.hasta) {
      where.fecha = Between(
        new Date(`${filtros.desde}T00:00:00.000Z`),
        new Date(`${filtros.hasta}T23:59:59.999Z`),
      );
    } else if (filtros.desde) {
      where.fecha = MoreThanOrEqual(new Date(`${filtros.desde}T00:00:00.000Z`));
    } else if (filtros.hasta) {
      where.fecha = LessThanOrEqual(new Date(`${filtros.hasta}T23:59:59.999Z`));
    }

    const [datos, total] = await this.bitacoraRepository.findAndCount({
      where,
      relations: { usuario: true },
      order: { fecha: 'DESC' },
      skip: (pagina - 1) * limite,
      take: limite,
    });

    return { datos, total, pagina, limite };
  }

  // Historial de un registro concreto ("¿qué le pasó a este abonado?").
  // Es el reemplazo directo de los GET /:id/historial que hoy consultan las
  // tablas viejas.
  async historialDeRegistro(
    modulo: ModuloBitacora,
    registroId: number,
  ): Promise<Bitacora[]> {
    return await this.bitacoraRepository.find({
      where: { modulo, registro_id: registroId },
      relations: { usuario: true },
      order: { fecha: 'DESC' },
    });
  }
}