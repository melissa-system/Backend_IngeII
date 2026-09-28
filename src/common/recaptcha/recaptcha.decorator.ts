import { applyDecorators, UseGuards } from '@nestjs/common';
import { RecaptchaGuard } from './recaptcha.guard';

// Protege un endpoint público con reCAPTCHA. Es la forma de aplicarlo en
// cualquier formulario público nuevo, sin repetir lógica:
//
//   @Post()
//   @ProtegidoConRecaptcha()
//   create(...) { ... }
//
// El módulo del controller debe importar RecaptchaModule.
export const ProtegidoConRecaptcha = () =>
  applyDecorators(UseGuards(RecaptchaGuard));
