// Catálogo de roles que deben existir como filas en la tabla `roles`.
// El `name` de cada fila debe coincidir EXACTAMENTE con los valores del enum
// Role (common/enums/roles.enum.ts): el frontend (AuthContext.tsx, ROL_LABELS)
// espera recibir estos mismos strings en minúscula en la respuesta de
// /auth/login, /auth/refresh y /auth/perfil. No cambiar estos valores sin
// actualizar también el frontend.
export const CATALOGO_ROLES: Array<{ name: string; description: string }> = [
  { name: 'super_admin', description: 'Junta Directiva (Acceso total)' },
  { name: 'admin', description: 'Personal Administrativo' },
  { name: 'fontanero', description: 'Técnico de campo' },
  { name: 'abonado', description: 'Usuario / Cliente registrado' },
];
