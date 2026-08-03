import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AveriasService } from './averias.service';

// 1. Le decimos a NestJS que la ruta para este controlador será 'averias'
// Es decir: http://localhost:3000/averias
@Controller('averias')
export class AveriasController {
  // 2. Inyectamos el servicio para poder usar sus funciones
  constructor(private readonly averiasService: AveriasService) {}

  // 3. Endpoint para CREAR una avería (Método POST)
  // Cuando React envíe datos a http://localhost:3000/averias, caerán aquí
  @Post()
  async create(@Body() datosAveria: any) {
    return await this.averiasService.create(datosAveria);
  }

  // 4. Endpoint para TRAER TODAS las averías (Método GET)
  // React lo consume llamando a http://localhost:3000/averias
  @Get()
  async findAll() {
    return await this.averiasService.findAll();
  }

  // 5. Endpoint para TRAER UNA sola avería por su ID (Método GET con parámetro)
  // Ejemplo: http://localhost:3000/averias/5
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.averiasService.findOne(id);
  }
}
