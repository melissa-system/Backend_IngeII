import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from './entities/configuracion.entity';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { EmpleadosService } from '../empleados/empleados.service';
import { User } from '../auth/entities/user.entity';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ModuloBitacora } from '../bitacora/entities/bitacora.enums';

// Campos de configuración que se auditan. Deben coincidir EXACTAMENTE con
// las columnas de configuracion.entity.ts: si un nombre no coincide, el
// código compila igual pero ese campo nunca se registra en la bitácora.
//
// Se enumeran a mano en vez de recorrer la entidad completa para que
// agregar una columna nueva sea una decisión consciente sobre si debe
// auditarse o no (id, fechas y la relación con empleado no se auditan).
const CAMPOS_AUDITABLES = [
  'direccion',
  'telefono',
  'correo_electronico',
  'enlace_google_maps',
  'coordenadas_mapa',
  'telefono_miembro_junta_1',
  'telefono_miembro_junta_2',
  'horario_lunes_viernes',
  'horario_sabado',
  'horario_domingo',
];

/**
 * Servicio de configuración general de la ASADA.
 * Tabla singleton: siempre existe una sola fila (id=1).
 * Si no existe al consultarla, se crea con los valores por defecto de la entity.
 */
@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(Configuracion)
    private readonly repo: Repository<Configuracion>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly empleadosService: EmpleadosService,
    private readonly bitacoraService: BitacoraService,
  ) {}

  /**
   * Retorna la configuración actual. Si no existe la fila, la crea
   * con los valores por defecto definidos en la entity.
   */
  async obtener(): Promise<Configuracion> {
    let config = await this.repo.findOne({ where: { id: 1 } });
    if (!config) {
      config = this.repo.create({ id: 1 });
      config = await this.repo.save(config);
    }
    return config;
  }

  /**
   * Actualiza parcialmente la configuración (solo campos enviados).
   * usuarioId es el id de la cuenta autenticada que hace la petición; se
   * resuelve al empleado vinculado (si lo hay) para dejar registrado quién
   * hizo el último cambio.
   *
   * Cada campo modificado queda además en la bitácora general: esta
   * configuración define lo que ven los abonados en el sitio público
   * (horario, teléfono, dirección), así que conviene poder rastrear quién
   * cambió qué y cuándo.
   */
  async actualizar(
    dto: UpdateConfiguracionDto,
    usuarioId?: number,
  ): Promise<Configuracion> {
    const config = await this.obtener();

    // Copia de los valores anteriores ANTES del Object.assign, para poder
    // compararlos después: una vez asignado el DTO, el original se pierde.
    const antes = { ...config } as Record<string, unknown>;

    Object.assign(config, dto);
    config.empleado = usuarioId
      ? await this.empleadosService.buscarPorUsuarioId(usuarioId)
      : config.empleado;

    const guardada = await this.repo.save(config);

    // La configuración es una fila única (id = 1), así que todos sus
    // movimientos quedan agrupados bajo ese mismo registro_id en la bitácora.
    if (usuarioId) {
      const cambios = BitacoraService.compararCampos(
        antes,
        dto as unknown as Record<string, unknown>,
        CAMPOS_AUDITABLES,
      );

      if (cambios.length > 0) {
        const usuario = await this.userRepository.findOneBy({ id: usuarioId });
        await this.bitacoraService.registrarEdicion(
          ModuloBitacora.CONFIGURACION,
          guardada.id,
          { id: usuarioId, email: usuario?.email ?? null },
          cambios,
        );
      }
    }

    return guardada;
  }
}