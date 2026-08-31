// DataSource para el CLI de TypeORM (migration:generate / migration:run /
// migration:revert). Es independiente de la conexión que arma app.module.ts
// para la app en caliente (esa sigue con autoLoadEntities + synchronize:true
// para el día a día); esta conexión SIEMPRE tiene synchronize:false porque
// su único trabajo es aplicar migraciones explícitas de forma controlada.
import 'reflect-metadata';
import { configDotenv } from 'dotenv';
import { DataSource } from 'typeorm';

configDotenv({ path: '.env', override: true });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: false,
  entities: [`${__dirname}/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
});
