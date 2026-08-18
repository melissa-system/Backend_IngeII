import { Injectable } from '@nestjs/common';
import { CreateAbonadoDto } from './dto/create-abonado.dto';

@Injectable()
export class AbonadosService {
  async create(createAbonadoDto: CreateAbonadoDto) {
    return { message: 'Abonado creado exitosamente', data: createAbonadoDto };
  }

  async findAll() {
    return { message: 'Listado de abonados obtenido correctamente', data: [] };
  }
}