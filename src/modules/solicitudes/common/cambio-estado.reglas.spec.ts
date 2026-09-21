import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  ActualizarEstadoSolicitudDto,
  MIN_MOTIVO_RECHAZO,
} from './dto/actualizar-estado-solicitud.dto';
import { ActualizarEstadoSolicitudOtroDto } from '../otro/dto/actualizar-estado-solicitud-otro.dto';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/roles.enum';
import { SolicitudesCambioMedidorController } from '../cambio-medidor/controllers/solicitudes.cambio-medidor.controller';
import { SolicitudesCambioPropietarioController } from '../cambio-propietario/controllers/solicitudes.cambio-propietario.controller';
import { CambioRepresentanteController } from '../cambio-representante/controllers/solicitudes.cambio-representante.controller';
import { SolicitudesOtroController } from '../otro/controllers/solicitudes.otro.controller';

// Reglas comunes del cambio de estado de solicitudes, que no dependen de un
// tipo de trámite en particular:
//  - 400: el motivo es obligatorio al rechazar (y en "otro", también al
//    aprobar). Lo aplica el ValidationPipe global con los DTOs, así que se
//    prueba validando el DTO igual que lo hace NestJS.
//  - 403: un Abonado no puede cambiar el estado. Lo aplica el RolesGuard
//    según el @Roles de cada ruta, así que se prueban las dos piezas: que la
//    ruta exija ADMIN y que el guard rechace al Abonado.

async function erroresDe<T extends object>(clase: new () => T, datos: object) {
  // Igual que el ValidationPipe: primero transforma (aplica @Transform, por
  // ejemplo el recorte de espacios) y después valida.
  const errores = await validate(plainToInstance(clase, datos));
  return errores.map((e) => e.property);
}

const motivoValido = 'x'.repeat(MIN_MOTIVO_RECHAZO);

describe('Cambio de estado de solicitudes — reglas comunes', () => {
  // --- 400: motivo obligatorio al rechazar ---
  describe('ActualizarEstadoSolicitudDto (medidor, propietario, representante)', () => {
    it('rechazar SIN motivo es inválido', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudDto, { estado: 'rechazado' }),
      ).toContain('motivoRechazo');
    });

    it('rechazar con un motivo más corto que el mínimo es inválido', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudDto, {
          estado: 'rechazado',
          motivoRechazo: 'x'.repeat(MIN_MOTIVO_RECHAZO - 1),
        }),
      ).toContain('motivoRechazo');
    });

    it('un motivo de puros espacios no cuenta como motivo', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudDto, {
          estado: 'rechazado',
          motivoRechazo: ' '.repeat(MIN_MOTIVO_RECHAZO + 5),
        }),
      ).toContain('motivoRechazo');
    });

    it('rechazar con un motivo válido pasa', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudDto, {
          estado: 'rechazado',
          motivoRechazo: motivoValido,
        }),
      ).toEqual([]);
    });

    it.each(['aprobado', 'en_proceso', 'pendiente'])(
      'en estado %s el motivo sigue siendo opcional',
      async (estado) => {
        expect(await erroresDe(ActualizarEstadoSolicitudDto, { estado })).toEqual([]);
      },
    );

    it('un estado fuera del catálogo es inválido', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudDto, { estado: 'cancelado' }),
      ).toContain('estado');
    });
  });

  describe('ActualizarEstadoSolicitudOtroDto', () => {
    it.each(['aprobado', 'rechazado'])(
      'en estado %s el comentario es obligatorio',
      async (estado) => {
        expect(
          await erroresDe(ActualizarEstadoSolicitudOtroDto, { estado }),
        ).toContain('motivoRechazo');
      },
    );

    it('usa el mismo mínimo que las demás solicitudes y que el frontend', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudOtroDto, {
          estado: 'aprobado',
          motivoRechazo: 'x'.repeat(MIN_MOTIVO_RECHAZO - 1),
        }),
      ).toContain('motivoRechazo');
      expect(
        await erroresDe(ActualizarEstadoSolicitudOtroDto, {
          estado: 'aprobado',
          motivoRechazo: motivoValido,
        }),
      ).toEqual([]);
    });

    it('marcar en proceso no exige comentario', async () => {
      expect(
        await erroresDe(ActualizarEstadoSolicitudOtroDto, { estado: 'en_proceso' }),
      ).toEqual([]);
    });
  });

  // --- 403: solo administración puede cambiar el estado ---
  describe('permisos de la ruta PATCH :id/estado', () => {
    const controladores = [
      ['cambio de medidor', SolicitudesCambioMedidorController],
      ['cambio de propietario', SolicitudesCambioPropietarioController],
      ['cambio de representante', CambioRepresentanteController],
      ['otro', SolicitudesOtroController],
    ] as const;

    it.each(controladores)(
      'la ruta de %s exige rol ADMIN y NO admite ABONADO',
      (_nombre, controlador) => {
        const roles = Reflect.getMetadata(
          ROLES_KEY,
          controlador.prototype.cambiarEstado,
        ) as Role[];

        expect(roles).toEqual([Role.ADMIN]);
        expect(roles).not.toContain(Role.ABONADO);
      },
    );

    // Contexto de ejecución falso: el guard solo necesita el handler, la
    // clase y el usuario del request.
    function contexto(role: Role | undefined): ExecutionContext {
      return {
        getHandler: () => SolicitudesCambioMedidorController.prototype.cambiarEstado,
        getClass: () => SolicitudesCambioMedidorController,
        switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 1, role } : undefined }) }),
      } as unknown as ExecutionContext;
    }

    const guard = new RolesGuard(new Reflector());

    it('el guard responde 403 a un Abonado', () => {
      expect(() => guard.canActivate(contexto(Role.ABONADO))).toThrow(ForbiddenException);
    });

    it('el guard responde 403 a un Fontanero', () => {
      expect(() => guard.canActivate(contexto(Role.FONTANERO))).toThrow(ForbiddenException);
    });

    it('el guard responde 403 si no hay usuario autenticado', () => {
      expect(() => guard.canActivate(contexto(undefined))).toThrow(ForbiddenException);
    });

    it('el guard deja pasar a un Administrador', () => {
      expect(guard.canActivate(contexto(Role.ADMIN))).toBe(true);
    });

    it('el guard deja pasar a la Junta Directiva (acceso total)', () => {
      expect(guard.canActivate(contexto(Role.SUPER_ADMIN))).toBe(true);
    });
  });
});
