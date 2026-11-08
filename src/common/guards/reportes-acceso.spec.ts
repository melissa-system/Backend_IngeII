import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/roles.enum';
import { AbonadosController } from '../../modules/abonados/abonados.controller';
import { AveriasController } from '../../modules/averias/averias.controller';
import { SolicitudesEstadisticasController } from '../../modules/solicitudes/estadisticas/controllers/solicitudes-estadisticas.controller';

// PBI 341 / Task 345: los tres reportes estadísticos (abonados, solicitudes y
// averías) alimentan la pantalla de Reportes y su exportación a PDF/CSV. Estas
// pruebas confirman que solo el perfil administrativo puede consultarlos y que
// cualquier otro perfil es rechazado con 403.
const REPORTES = [
  { nombre: 'abonados', controlador: AbonadosController },
  { nombre: 'solicitudes', controlador: SolicitudesEstadisticasController },
  { nombre: 'averías', controlador: AveriasController },
] as const;

function contextoPara(
  controlador: (typeof REPORTES)[number]['controlador'],
  user: { id: number; role: string } | undefined,
): ExecutionContext {
  return {
    getHandler: () => controlador.prototype.obtenerEstadisticas,
    getClass: () => controlador,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

// Guards declarados en el método o, si no, en la clase del controlador.
function guardsDe(controlador: (typeof REPORTES)[number]['controlador']) {
  return [
    ...(Reflect.getMetadata(
      GUARDS_METADATA,
      controlador.prototype.obtenerEstadisticas,
    ) ?? []),
    ...(Reflect.getMetadata(GUARDS_METADATA, controlador) ?? []),
  ];
}

describe('Acceso a reportes estadísticos y su exportación (PBI 341 / Task 345)', () => {
  const guard = new RolesGuard(new Reflector());

  describe.each(REPORTES)('Reporte de $nombre', ({ controlador }) => {
    it('el endpoint de estadísticas exige autenticación (JwtAuthGuard) y rol (RolesGuard)', () => {
      const guards = guardsDe(controlador);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('el endpoint de estadísticas está restringido al rol administrativo', () => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          controlador.prototype.obtenerEstadisticas,
        ),
      ).toEqual([Role.ADMIN]);
    });

    it('permite el acceso al personal administrativo', () => {
      expect(
        guard.canActivate(
          contextoPara(controlador, { id: 1, role: Role.ADMIN }),
        ),
      ).toBe(true);
    });

    it('permite el acceso a la Junta Directiva (super_admin)', () => {
      expect(
        guard.canActivate(
          contextoPara(controlador, { id: 2, role: Role.SUPER_ADMIN }),
        ),
      ).toBe(true);
    });

    it.each([Role.FONTANERO, Role.ABONADO])(
      'rechaza con 403 a un perfil no administrativo (%s)',
      (rol) => {
        expect(() =>
          guard.canActivate(contextoPara(controlador, { id: 3, role: rol })),
        ).toThrow(ForbiddenException);
      },
    );

    it('rechaza con 403 una petición sin usuario autenticado', () => {
      expect(() =>
        guard.canActivate(contextoPara(controlador, undefined)),
      ).toThrow(ForbiddenException);
    });
  });
});
