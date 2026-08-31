// Siembra la tabla `roles` con el catálogo de CATALOGO_ROLES.
// Idempotente: si un rol ya existe (por name) no lo duplica, solo actualiza
// su descripción si cambió. Seguro de correr varias veces.
//
// Uso:
//   npm run seed:roles
import 'reflect-metadata';
import { configDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { RoleEntity } from '../modules/auth/entities/role.entity';
import { Permission } from '../modules/auth/entities/permission.entity';
import { User } from '../modules/auth/entities/user.entity';
import { RefreshToken } from '../modules/auth/entities/refresh-token.entity';
import { CATALOGO_ROLES } from './roles-catalogo';

configDotenv({ path: '.env', override: true });

export async function sembrarRoles(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(RoleEntity);

  for (const { name, description } of CATALOGO_ROLES) {
    const existente = await repo.findOne({ where: { name } });
    if (existente) {
      if (existente.description !== description) {
        existente.description = description;
        await repo.save(existente);
        console.log(`Rol '${name}' actualizado (descripción).`);
      } else {
        console.log(`Rol '${name}' ya existía, sin cambios.`);
      }
    } else {
      await repo.save(repo.create({ name, description }));
      console.log(`Rol '${name}' creado.`);
    }
  }
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, RoleEntity, Permission, RefreshToken],
    // El esquema lo gestiona la app con synchronize:true; aquí solo leemos/escribimos filas.
    synchronize: false,
  });

  await dataSource.initialize();
  try {
    await sembrarRoles(dataSource);
    console.log('Listo: catálogo de roles sembrado.');
  } finally {
    await dataSource.destroy();
  }
}

// Permite importar sembrarRoles() desde otro script (seed-admin.ts) sin
// disparar esta ejecución standalone.
if (require.main === module) {
  void main().catch((error) => {
    console.error('Error sembrando roles:', error);
    process.exit(1);
  });
}
