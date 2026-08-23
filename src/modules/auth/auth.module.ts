import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
<<<<<<< HEAD
import { RoleEntity } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
=======
import { PasswordResetToken } from './entities/password-reset-token.entity';
>>>>>>> 6e03b8fa9b6c47021debd220306acbf5c0d08b51
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailService } from './mail.service';
import { POLITICA_LOGIN_THROTTLE } from './auth-throttle.config';

@Module({
  imports: [
<<<<<<< HEAD
    TypeOrmModule.forFeature([User, RefreshToken, RoleEntity, Permission]),
=======
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
>>>>>>> 6e03b8fa9b6c47021debd220306acbf5c0d08b51
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
  ],
<<<<<<< HEAD
  controllers: [AuthController, RolesController],
  providers: [AuthService, RolesService, LocalStrategy, JwtStrategy],
  exports: [AuthService, RolesService, TypeOrmModule],
=======
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, MailService],
  exports: [TypeOrmModule],
>>>>>>> 6e03b8fa9b6c47021debd220306acbf5c0d08b51
})
export class AuthModule {}