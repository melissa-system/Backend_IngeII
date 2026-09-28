import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaGuard } from './recaptcha.guard';

// Mismo criterio que CloudinaryModule y BitacoraModule: no se marca @Global
// a propósito, para que quede explícito qué módulos tienen endpoints
// públicos protegidos.
@Module({
  imports: [ConfigModule],
  providers: [RecaptchaService, RecaptchaGuard],
  exports: [RecaptchaService, RecaptchaGuard],
})
export class RecaptchaModule {}
