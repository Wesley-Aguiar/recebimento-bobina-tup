export interface EstoquePrevisto {
  coilNumber: string; // Primary Key
  BL: string;
  navio: string;
  viagem: string;
}

export interface EstoqueRecebido {
  coilNumber: string; // Primary Key
  BL: string;
  navio: string;
  viagem: string;
  dataRecebimento: string; // ISO date string or timestamp
  usuarioRecebimento: string; // Email of the user who registered it
  observacoes?: string;
}
