/**
 * Utilitários para validação e formatação de CPF
 */

/**
 * Remove caracteres não numéricos do CPF
 */
export const cleanCPF = (cpf: string): string => {
  return cpf.replace(/[^\d]/g, '');
};

/**
 * Formata CPF com máscara (000.000.000-00)
 */
export const formatCPF = (cpf: string): string => {
  const cleaned = cleanCPF(cpf);
  
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
};

/**
 * Valida se o CPF é válido
 */
export const validateCPF = (cpf: string): boolean => {
  const cleaned = cleanCPF(cpf);
  
  // Verifica se tem 11 dígitos
  if (cleaned.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Calcula o primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;
  
  // Verifica o primeiro dígito
  if (parseInt(cleaned.charAt(9)) !== digit1) return false;
  
  // Calcula o segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;
  
  // Verifica o segundo dígito
  return parseInt(cleaned.charAt(10)) === digit2;
};

/**
 * Máscara de input para CPF
 */
export const cpfMask = (value: string): string => {
  return formatCPF(value);
};

/**
 * Valida e retorna mensagem de erro se inválido
 */
export const validateCPFWithMessage = (cpf: string): { isValid: boolean; message?: string } => {
  const cleaned = cleanCPF(cpf);
  
  if (!cleaned) {
    return { isValid: false, message: 'CPF é obrigatório' };
  }
  
  if (cleaned.length !== 11) {
    return { isValid: false, message: 'CPF deve ter 11 dígitos' };
  }
  
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return { isValid: false, message: 'CPF não pode ter todos os dígitos iguais' };
  }
  
  if (!validateCPF(cpf)) {
    return { isValid: false, message: 'CPF inválido' };
  }
  
  return { isValid: true };
};