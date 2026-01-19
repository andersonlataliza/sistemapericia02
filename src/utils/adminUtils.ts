/**
 * Utilitários para verificação de permissões de administrador
 */

// Email do administrador do sistema
const ADMIN_EMAIL = 'anderson.lataliza@gmail.com';

/**
 * Verifica se o email fornecido é do administrador
 * @param email - Email do usuário para verificar
 * @returns true se for o administrador, false caso contrário
 */
export const isAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

/**
 * Verifica se o usuário atual é administrador
 * @param user - Objeto do usuário do Supabase
 * @returns true se for o administrador, false caso contrário
 */
export const isCurrentUserAdmin = (user: { email?: string } | null): boolean => {
  return isAdmin(user?.email);
};