import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from './entities/configuracion.entity';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { EmpleadosService } from '../empleados/empleados.service';

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
    private readonly empleadosService: EmpleadosService,
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
   */
  async actualizar(
    dto: UpdateConfiguracionDto,
    usuarioId?: number,
  ): Promise<Configuracion> {
    const config = await this.obtener();
    Object.assign(config, dto);
    config.empleado = usuarioId
      ? await this.empleadosService.buscarPorUsuarioId(usuarioId)
      : config.empleado;
    return this.repo.save(config);
  }
}
