// Política de hashing de contraseñas: factor de costo de bcrypt compartido
// por el seed (creación/actualización de usuarios) y el cambio de contraseña.
//
// Cada incremento de 1 en el costo DUPLICA el tiempo de cálculo, y con ello
// la resistencia a fuerza bruta offline. OWASP recomienda un costo >= 10;
// elegimos 12 como equilibrio seguridad/rendimiento para bcryptjs (implementación
// pura en JS, más lenta que la nativa). Los hashes guardan su costo embebido
// ($2b$12$...), así que validar hashes antiguos (p. ej. costo 10) sigue
// funcionando sin ninguna migración.
export const BCRYPT_COST = 12;
