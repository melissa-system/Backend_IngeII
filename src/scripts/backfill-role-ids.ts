// Backfill de usuarios.role_id a partir del valor actual de la columna
// enum `role`. Se debe correr UNA VEZ, contra la base de datos real, ANTES
// de quitar la columna `role` de user.entity.ts — si se elimina la columna
// primero, `synchronize: true` la borra de MySQL y se pierde la única fuente
// para saber qué rol tenía cada usuario.
//
// Es seguro correrlo varias veces: solo toca filas con role_id IS NULL.
// No usa las entidades de TypeORM (SQL crudo), así que no depende de cómo
// esté definida la entidad User en este momento.
//
// Uso:
//   npm run backfill:roles
import { configDotenv } from 'dotenv';
import { DataSource } from 'typeorm';

configDotenv({ path: '.env', override: true });

interface FilaUsuario {
  id: number;
  email: string;
  role: string | null;
  role_id: number | null;
}

interface FilaRol {
  id: number;
  name: string;
}

async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const roles: FilaRol[] = await dataSource.query(
      'SELECT id, name FROM roles',
    );
    if (roles.length === 0) {
      console.error(
        'La tabla roles está vacía. Corré primero "npm run seed:roles" y volvé a intentar.',
      );
      process.exitCode = 1;
      return;
    }
    const idPorNombre = new Map(roles.map((r) => [r.name, r.id]));

    const usuarios: FilaUsuario[] = await dataSource.query(
      'SELECT id, email, role, role_id FROM usuarios',
    );

    let actualizados = 0;
    let yaTenian = 0;
    const sinCoincidencia: FilaUsuario[] = [];

    for (const usuario of usuarios) {
      if (usuario.role_id !== null) {
        yaTenian++;
        continue;
      }

      const roleId = usuario.role ? idPorNombre.get(usuario.role) : undefined;
      if (roleId === undefined) {
        sinCoincidencia.push(usuario);
        continue;
      }

      await dataSource.query(
        'UPDATE usuarios SET role_id = ? WHERE id = ? AND role_id IS NULL',
        [roleId, usuario.id],
      );
      actualizados++;
    }

    console.log('--- Backfill de role_id ---');
    console.log(`Usuarios totales:        ${usuarios.length}`);
    console.log(`Ya tenían role_id:       ${yaTenian}`);
    console.log(`Actualizados ahora:      ${actualizados}`);
    console.log(`Sin coincidencia:        ${sinCoincidencia.length}`);

    if (sinCoincidencia.length > 0) {
      console.log('');
      console.log(
        'Estos usuarios NO se pudieron actualizar (su valor de role no',
      );
      console.log(
        'coincide con ningún name en la tabla roles). Revisalos a mano',
      );
      console.log('antes de quitar la columna role de la entidad:');
      for (const u of sinCoincidencia) {
        console.log(`  id=${u.id} email=${u.email} role='${u.role}'`);
      }
      process.exitCode = 1;
    } else {
      console.log('');
      console.log(
        'Todos los usuarios tienen role_id asignado. Ya se puede continuar',
      );
      console.log('con el cambio en user.entity.ts.');
    }
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error('Error ejecutando el backfill:', error);
  process.exit(1);
});
