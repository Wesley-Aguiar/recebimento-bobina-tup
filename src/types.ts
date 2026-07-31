export interface EstoquePrevisto {
  coilNumber: string; // Primary Key
  BL: string;
  navio: string;
  viagem: string;
  grossWeight?: string | number;
}

export interface EstoqueRecebido {
  coilNumber: string; // Primary Key
  BL: string;
  navio: string;
  viagem: string;
  dataRecebimento: string; // ISO date string or timestamp
  usuarioRecebimento: string; // Email of the user who registered it
  observacoes?: string;
  grossWeight?: string | number;
}

export type UserRole = "admin" | "comum";

export interface UsuarioPerfil {
  email: string;
  role: UserRole;
  nome?: string;
  dataCadastro?: string;
  ultimoAcesso?: string;
}
