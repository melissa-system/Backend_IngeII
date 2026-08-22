import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { User } from '../entities/user.entity';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';

// Estrategia del login inicial: valida email + contraseña contra la BD.
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<User> {
    // Los guards corren antes que los pipes globales, así que las validaciones
    // de formato del LoginDto se aplican aquí para poder responder 400
    // (formato) y dejar el 401 solo para credenciales incorrectas.
    const dto = plainToInstance(LoginDto, { email, password });
    const errores = await validate(dto);
    if (errores.length > 0) {
      const mensajes = errores.flatMap((e) => Object.values(e.constraints ?? {}));
      throw new BadRequestException(mensajes);
    }

    const user = await this.authService.validateUser(email, password);
    if (!user) {
      // Mensaje genérico a propósito: no revela si el correo existe o no.
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
}
