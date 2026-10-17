import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { ReporteFontanero } from '../modules/reportes-fontanero/entities/reporte-fontanero.entity';
import { EstadoRevisionReporte } from '../modules/reportes-fontanero/entities/reporte-fontanero.enums';

// Limpia los reportes del flujo anterior:
//  1) Los reportes SIN avería vinculada no tienen resolución que revisar: se
//     normalizan a "Aprobado" (antes quedaban en "Pendiente" sin mostrarse).
//  2) Duplicados: cuando un reporte era rechazado y el fontanero lo rehacía, se
//     creaba una fila nueva en vez de actualizar la anterior.
//
// Regla de duplicados: por cada par (avería, fontanero) se conserva SIEMPRE la
// fila más reciente (mayor id). Las filas anteriores que estén "Rechazado" se
// eliminan. Las anteriores que NO estén rechazadas se dejan intactas y solo se
// avisa, para no perder evidencia ni datos válidos.
//
// Uso: npm run cleanup:reportes

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(ReporteFontanero);

    // 1) Normaliza los reportes sin avería a "Aprobado".
    const normalizados = await repo
      .createQueryBuilder()
      .update(ReporteFontanero)
      .set({ estado_revision: EstadoRevisionReporte.APROBADO })
      .where('averia_id IS NULL')
      .andWhere('estado_revision <> :aprobado', {
        aprobado: EstadoRevisionReporte.APROBADO,
      })
      .execute();
    console.log(
      `Reportes sin avería marcados como Aprobado: ${normalizados.affected ?? 0}.`,
    );

    // 2) Elimina duplicados por (avería, fontanero).
    const todos = await repo.find({
      order: { averia_id: 'ASC', empleado_id: 'ASC', id: 'ASC' },
    });

    // Agrupa por avería + fontanero (solo reportes con avería vinculada).
    const grupos = new Map<string, ReporteFontanero[]>();
    for (const reporte of todos) {
      if (reporte.averia_id === null) continue;
      const clave = `${reporte.averia_id}|${reporte.empleado_id}`;
      const lista = grupos.get(clave) ?? [];
      lista.push(reporte);
      grupos.set(clave, lista);
    }

    let eliminados = 0;
    let conservadosConAviso = 0;

    for (const lista of grupos.values()) {
      if (lista.length <= 1) continue;
      // Ordenadas por id ASC: la última es la más reciente.
      const masReciente = lista[lista.length - 1];
      const anteriores = lista.slice(0, -1);

      for (const viejo of anteriores) {
        if (viejo.estado_revision === EstadoRevisionReporte.RECHAZADO) {
          await repo.remove(viejo);
          eliminados += 1;
          console.log(
            `Eliminado reporte #${viejo.id} (avería ${viejo.averia_id}) duplicado del #${masReciente.id}.`,
          );
        } else {
          conservadosConAviso += 1;
          console.warn(
            `Se conserva el reporte #${viejo.id} (avería ${viejo.averia_id}) aunque no es el más reciente, porque no está rechazado (estado: ${viejo.estado_revision}). Revisar manualmente.`,
          );
        }
      }
    }

    console.log(
      `\nListo. Reportes duplicados eliminados: ${eliminados}. Filas no rechazadas conservadas por precaución: ${conservadosConAviso}.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error) => {
  console.error('Error limpiando reportes duplicados:', error);
  process.exit(1);
});
