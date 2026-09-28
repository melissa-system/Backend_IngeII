import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solicitud } from '../../common/entities/solicitud.entity';
import { SolicitudPajaAgua } from '../../paja-agua/entities/solicitud-paja-agua.entity';
import { FiltroEstadisticasSolicitudesDto } from '../dto/filtro-estadisticas-solicitudes.dto';

// Una fila normalizada por solicitud para la página de reportes. Tipos y
// estados se traducen a etiquetas legibles y las dos familias de tablas
// (solicitudes genéricas + solicitud_paja_agua) se unifican en el mismo
// contrato para que el frontend las consuma con una sola lógica.
export interface RegistroSolicitudEstadistica {
  codigo: string;
  tipo: string;
  solicitante: string;
  estado: string;
  fecha: string;
}

export interface EstadisticasSolicitudesRespuesta {
  total: number;
  porTipo: { tipo: string; total: number }[];
  porEstado: { estado: string; total: number }[];
  registros: RegistroSolicitudEstadistica[];
}

// Etiquetas legibles de los tipo_solicitud de la tabla genérica 'solicitudes'.
const MAPA_TIPOS: Record<string, string> = {
  paja_agua: 'Paja de agua',
  cambio_propietario: 'Cambio de propietario',
  cambio_representante: 'Cambio de representante',
  cambio_medidor: 'Cambio de medidor',
  otro: 'Otro',
};

// Unifica los estados de ambas familias (la genérica los guarda en minúscula
// y sin tilde; solicitud_paja_agua en Título con 'Aprobada/Completada') en
// un solo conjunto de etiquetas título.
const MAPA_ESTADOS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  enproceso: 'En proceso',
  aprobado: 'Aprobada',
  aprobada: 'Aprobada',
  rechazado: 'Rechazada',
  rechazada: 'Rechazada',
  completada: 'Completada',
};

@Injectable()
export class SolicitudesEstadisticasService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudPajaAgua)
    private readonly pajaAguaRepository: Repository<SolicitudPajaAgua>,
  ) {}

  // Igual contrato que las estadísticas de averías y abonados. Como las
  // solicitudes viven en dos familias de tablas distintas, se cargan todas
  // y se agregan en memoria (el volumen es bajo y evita SQL de unión).
  async obtenerEstadisticas(
    filtros: FiltroEstadisticasSolicitudesDto,
  ): Promise<EstadisticasSolicitudesRespuesta> {
    if (filtros.fechaInicio?.trim() && filtros.fechaFin?.trim()) {
      if (filtros.fechaInicio > filtros.fechaFin) {
        throw new BadRequestException(
          'La fecha de inicio no puede ser posterior a la fecha de fin',
        );
      }
    }

    const [genericas, pajas] = await Promise.all([
      this.solicitudRepository.find({
        relations: { abonado: { fisico: true } },
      }),
      this.pajaAguaRepository.find(),
    ]);

    const registros = [
      ...this.genericasARegistros(genericas),
      ...this.pajasARegistros(pajas),
    ];
    const filtradas = registros.filter((r) => this.cumpleFiltros(r, filtros));
    filtradas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    return {
      total: filtradas.length,
      porTipo: this.contarPor(filtradas, (r) => r.tipo).map((item) => ({
        tipo: item.nombre,
        total: item.total,
      })),
      porEstado: this.contarPor(filtradas, (r) => r.estado).map((item) => ({
        estado: item.nombre,
        total: item.total,
      })),
      registros: filtradas,
    };
  }

  private genericasARegistros(
    genericas: Solicitud[],
  ): RegistroSolicitudEstadistica[] {
    return genericas.map((g) => {
      const abonado = g.abonado;
      const solicitante = abonado
        ? [abonado.nombre, abonado.fisico?.apellido1, abonado.fisico?.apellido2]
            .filter((parte) => parte && parte.trim() !== '')
            .join(' ')
        : '—';
      return {
        codigo: g.codigo_solicitud,
        tipo: MAPA_TIPOS[g.tipo_solicitud] ?? g.tipo_solicitud,
        solicitante,
        estado: this.normalizarEstado(g.estado),
        fecha: this.formatearFecha(g.fecha_creacion),
      };
    });
  }

  private pajasARegistros(
    pajas: SolicitudPajaAgua[],
  ): RegistroSolicitudEstadistica[] {
    return pajas.map((p) => ({
      codigo: p.codigo_solicitud,
      tipo: 'Paja de agua',
      solicitante: p.nombre_solicitante,
      estado: this.normalizarEstado(p.estado),
      fecha: this.formatearFecha(p.fecha_solicitud),
    }));
  }

  private normalizarEstado(estado: string): string {
    const clave = estado.trim().toLowerCase();
    return MAPA_ESTADOS[clave] ?? estado;
  }

  // Fecha como YYYY-MM-DD usando los componentes locales (evita el corrimiento
  // de zona horaria que sufriría Date#toISOString contra este MySQL).
  private formatearFecha(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private cumpleFiltros(
    registro: RegistroSolicitudEstadistica,
    filtros: FiltroEstadisticasSolicitudesDto,
  ): boolean {
    const inicio = filtros.fechaInicio?.trim().slice(0, 10);
    if (inicio && registro.fecha < inicio) return false;
    const fin = filtros.fechaFin?.trim().slice(0, 10);
    if (fin && registro.fecha > fin) return false;
    const tipo = filtros.tipo?.trim();
    if (tipo && tipo !== 'Todos' && registro.tipo !== tipo) return false;
    const estado = filtros.estado?.trim();
    if (estado && estado !== 'Todos' && registro.estado !== estado)
      return false;
    return true;
  }

  private contarPor(
    registros: RegistroSolicitudEstadistica[],
    getKey: (r: RegistroSolicitudEstadistica) => string,
  ): { nombre: string; total: number }[] {
    const conteo = new Map<string, number>();
    for (const r of registros) {
      const key = getKey(r);
      conteo.set(key, (conteo.get(key) ?? 0) + 1);
    }
    return Array.from(conteo.entries())
      .map(([nombre, total]) => ({
        nombre,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }
}
