require('dotenv').config({ path: '.env' });
const mysql = require('mysql2/promise');

const CORREO_A_CONSERVAR = 'melicaro1222@gmail.com';

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });

  const [usuarios] = await conn.query('SELECT id FROM usuarios WHERE email = ?', [
    CORREO_A_CONSERVAR,
  ]);
  if (usuarios.length === 0) {
    console.error(`No se encontro ningun usuario con correo ${CORREO_A_CONSERVAR}. Se aborta sin tocar nada.`);
    await conn.end();
    return;
  }
  const usuarioId = usuarios[0].id;

  const [abonados] = await conn.query('SELECT id FROM abonados WHERE usuario_id = ?', [usuarioId]);
  const abonadoId = abonados.length > 0 ? abonados[0].id : -1;

  const [empleados] = await conn.query('SELECT id FROM empleados WHERE usuario_id = ?', [usuarioId]);
  const empleadoId = empleados.length > 0 ? empleados[0].id : -1;

  console.log(`Conservando usuario id=${usuarioId}, abonado id=${abonadoId}, empleado id=${empleadoId} (${CORREO_A_CONSERVAR})`);

  // 1. Solicitudes de otros abonados (cascada automatica a
  //    solicitud_cambio_domicilio / solicitud_cambio_medidor).
  const [rSolic] = await conn.query('DELETE FROM solicitudes WHERE id_abonado != ?', [abonadoId]);
  console.log(`solicitudes borradas: ${rSolic.affectedRows}`);

  // 2. Desvincular (no borrar) el autor en tablas de contenido, para los
  //    empleados que se van a borrar.
  for (const tabla of ['publicaciones', 'documentos', 'averias', 'configuracion']) {
    const [r] = await conn.query(
      `UPDATE ${tabla} SET id_empleado = NULL WHERE id_empleado IS NOT NULL AND id_empleado != ?`,
      [empleadoId],
    );
    console.log(`${tabla}: id_empleado desvinculado en ${r.affectedRows} filas`);
  }
  // solicitud_paja_agua tambien tiene id_empleado nullable, mismo trato.
  const [rPaja] = await conn.query(
    'UPDATE solicitud_paja_agua SET id_empleado = NULL WHERE id_empleado IS NOT NULL AND id_empleado != ?',
    [empleadoId],
  );
  console.log(`solicitud_paja_agua: id_empleado desvinculado en ${rPaja.affectedRows} filas`);

  // 3. Abonados (cascada automatica a abonados_fisicos/abonados_juridicos/historial_abonados).
  const [rAbon] = await conn.query('DELETE FROM abonados WHERE id != ?', [abonadoId]);
  console.log(`abonados borrados: ${rAbon.affectedRows}`);

  // 4. Empleados.
  const [rEmp] = await conn.query('DELETE FROM empleados WHERE id != ?', [empleadoId]);
  console.log(`empleados borrados: ${rEmp.affectedRows}`);

  // 5. Usuarios (cascada automatica a refresh_tokens/password_reset_tokens/activation_tokens).
  const [rUsu] = await conn.query('DELETE FROM usuarios WHERE id != ?', [usuarioId]);
  console.log(`usuarios borrados: ${rUsu.affectedRows}`);

  console.log('Listo.');
  await conn.end();
})();
