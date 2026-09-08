import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { AuthService } from './auth.service';
import { RolesService } from './roles.service';

describe('UsersController', () => {
  let controller: UsersController;
  let authService: AuthService;
  let rolesService: RolesService;

  const mockUsers = [
    {
      id: 1,
      email: 'admin@test.com',
      role: 'admin',
      role_id: 1,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 2,
      email: 'abonado@test.com',
      role: 'abonado',
      role_id: 2,
      isActive: false,
      createdAt: new Date(),
    },
  ];

  const mockRoles = [
    { id: 1, name: 'admin', description: 'Administrador' },
    { id: 2, name: 'abonado', description: 'Abonado' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            listarUsuarios: jest.fn().mockResolvedValue(mockUsers),
            crearUsuarioPorAdmin: jest
              .fn()
              .mockImplementation((email: string, _pass: string, roleId: number) =>
                Promise.resolve({
                  id: 3,
                  email,
                  role: 'admin',
                  role_id: roleId,
                  isActive: true,
                }),
              ),
            cambiarEstadoUsuario: jest
              .fn()
              .mockImplementation(
                (id: number, isActive: boolean, _solicitanteId?: number) =>
                  Promise.resolve({ ...mockUsers[0], id, isActive }),
              ),
            cambiarRolUsuario: jest
              .fn()
              .mockImplementation((id: number, roleId: number) =>
                Promise.resolve({
                  ...mockUsers[0],
                  id,
                  role_id: roleId,
                  role: 'abonado',
                }),
              ),
          },
        },
        {
          provide: RolesService,
          useValue: {
            findAllRoles: jest.fn().mockResolvedValue(mockRoles),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    authService = module.get<AuthService>(AuthService);
    rolesService = module.get<RolesService>(RolesService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('debe retornar la lista de usuarios sin contraseñas', async () => {
      const result = await controller.findAll();

      expect(authService.listarUsuarios).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUsers);
      expect(result[0]).not.toHaveProperty('password');
    });
  });

  describe('findRoles', () => {
    it('debe retornar el catálogo de roles disponibles', async () => {
      const result = await controller.findRoles();
      expect(rolesService.findAllRoles).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRoles);
    });
  });

  describe('create', () => {
    it('debe crear un nuevo usuario por parte del administrador', async () => {
      const dto = {
        email: 'nuevo@asada.com',
        password: 'Password123!',
        role_id: 1,
      };
      const result = await controller.create(dto);

      expect(authService.crearUsuarioPorAdmin).toHaveBeenCalledWith(
        dto.email,
        dto.password,
        dto.role_id,
      );
      expect(result).toHaveProperty('id', 3);
      expect(result).toHaveProperty('email', 'nuevo@asada.com');
      expect(result).toHaveProperty('isActive', true);
    });
  });

  describe('cambiarEstado', () => {
    // req.user.id (id de quien hace la petición) se manda como tercer
    // argumento para que el service pueda rechazar la auto-inhabilitación
    // (ver AuthService.cambiarEstadoUsuario). Acá el solicitante (99) es
    // distinto del usuario objetivo (1) — caso normal, un admin inhabilita
    // a otro usuario.
    const mockReq = { user: { id: 99 } } as any;

    it('debe actualizar el estado de un usuario y reenviar el id del solicitante', async () => {
      const result = await controller.cambiarEstado(
        1,
        { isActive: false },
        mockReq,
      );
      expect(authService.cambiarEstadoUsuario).toHaveBeenCalledWith(
        1,
        false,
        99,
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('cambiarRol', () => {
    it('debe actualizar el rol de un usuario', async () => {
      const result = await controller.cambiarRol(1, { role_id: 2 });
      expect(authService.cambiarRolUsuario).toHaveBeenCalledWith(1, 2);
      expect(result.role_id).toBe(2);
    });
  });
});
