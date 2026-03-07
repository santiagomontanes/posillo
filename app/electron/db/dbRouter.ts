import { loadConfig } from '../config/app.config';

export const isMySqlEnabled = (): boolean => {
  const config = loadConfig();
  return config.dbMode === 'mysql';
};