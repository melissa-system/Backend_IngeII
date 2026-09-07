import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RoleEntity } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { ActivationToken } from './entities/activation-token.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Abonado } from '../abonados/entities/abonado.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailService } from './mail.service';
import { POLITICA_LOGIN_THROTTLE } from './auth-throttle.config';
import { CloudinaryModule } from '../../config/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      RoleEntity,
      Permission,
      PasswordResetToken,
      ActivationToken,
      Empleado,
      Abonado,
    ]),
    PassportModule,
    ThrottlerModule.forRoot([POLITICA_LOGIN_THROTTLE.default]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRES') ??
            '15m') as unknown as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    CloudinaryModule,
  ],
  controllers: [AuthController, RolesController, UsersController],
  providers: [AuthService, RolesService, LocalStrategy, JwtStrategy, MailService],
  exports: [AuthService, RolesService, MailService, TypeOrmModule],
})
export class AuthModule { }