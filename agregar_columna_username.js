// Agrega la columna 'username' a la tabla usuarios si no existe todavia.
// synchronize:true de TypeORM no la creo sola en la base de Aiven (pasa a
// veces con ALTER COLUMN sobre tablas con filas existentes), asi que se
// agrega a mano con este script, una sola vez.
//
// Uso: node agregar_columna_username.js
require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });

  const [columnas] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'username'`,
    [process.env.DB_DATABASE],
  );

  if (columnas.length > 0) {
    console.log('La columna username ya existe en usuarios. No se hace nada.');
  } else {
    await conn.query('ALTER TABLE usuarios ADD COLUMN username VARCHAR(30) NULL UNIQUE');
    console.log('Columna username agregada correctamente a usuarios.');
  }

  await conn.end();
})().catch((error) => {
  console.error('Error agregando la columna:', error.message);
  process.exit(1);
});
