// Seed del primer usuario administrador.
// Uso:
//   npm run seed                          -> usa los valores por defecto
//   npm run seed -- correo@x.com Clave1   -> email y contraseña personalizados
import 'reflect-metadata';
import { configDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../modules/auth/entities/user.entity';
import { Role } from '../common/enums/roles.enum';
import { BCRYPT_COST } from '../modules/auth/auth-password.config';

configDotenv({ path: '.env', override: true });

const EMAIL_POR_DEFECTO = 'asadapueblonuevo06@gmail.com';
const PASSWORD_POR_DEFECTO = 'admin123';

async function main(): Promise<void> {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = emailArg ?? EMAIL_POR_DEFECTO;
  const password = passwordArg ?? PASSWORD_POR_DEFECTO;

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User],
    // El esquema lo gestiona la app con synchronize:true; aquí solo leemos/escribimos.
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(User);
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const existente = await repo.findOne({ where: { email } });

    if (existente) {
      existente.password = hash;
      existente.role = Role.ADMIN;
      existente.isActive = true;
      await repo.save(existente);
      console.log(`Usuario ${email} actualizado correctamente.`);
    } else {
      await repo.insert({
        email,
        password: hash,
        role: Role.ADMIN,
        isActive: true,
      });
      console.log(`Usuario ${email} creado correctamente.`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error('Error ejecutando el seed:', error);
  process.exit(1);
});
