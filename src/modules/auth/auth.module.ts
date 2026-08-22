import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { POLITICA_LOGIN_THROTTLE } from './auth-throttle.config';

// El ThrottlerGuard solo se aplica donde se declare (ruta login); el
// contador de intentos vive en memoria y se limpia al reiniciar el proceso.
@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    PassportModule,
    ThrottlerModule.forRoot([POLITICA_LOGIN_THROTTLE.default]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          // El valor viene del .env (ej: '15m'); el casteo evita la fricción
          // de tipos entre string y StringValue de jsonwebtoken.
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRES') ??
            '15m') as unknown as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [TypeOrmModule],
})
export class AuthModule {}
