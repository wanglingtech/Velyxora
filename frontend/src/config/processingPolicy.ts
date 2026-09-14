export const PROCESSING_POLICY = {
  CLIENT_SIDE: { code: 'LOCAL', message: 'Se procesa en tu dispositivo.' },
  SERVER_SIDE: { code: 'SERVER', message: 'Se procesa temporalmente en los servidores de VELYXORA.' },
  HYBRID: { code: 'SERVER', message: 'Se procesa temporalmente en los servidores de VELYXORA.' },
  EXTERNAL_PROVIDER: { code: 'EXTERNAL', message: 'Puede depender de servicios externos.' },
} as const;
