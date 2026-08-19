import { Module } from '@nestjs/common';
import { AbonadosController } from './abonados.controller';
import { AbonadosService } from './abonados.service';

@Module({
  controllers: [AbonadosController],
  providers: [AbonadosService],
  exports: [AbonadosService],
})
export class AbonadosModule {}