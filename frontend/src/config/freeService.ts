// Concise free-service representation for the account UI.
//
// VELYXORA is free to use: there are no plans, credits or balances. Server
// processing requires authentication and is protected by technical fair-use
// safeguards. Keep this copy free of monetary/credit concepts.
export interface AccountServiceSummaryItem {
  label: string;
  value: string;
}

export const ACCOUNT_SERVICE_SUMMARY: AccountServiceSummaryItem[] = [
  { label: "Servicio", value: "GRATUITO" },
  { label: "Procesamiento servidor", value: "Disponible con inicio de sesión" },
  { label: "Uso responsable", value: "Protegido por límites técnicos" },
];
