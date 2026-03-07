export type BusinessConfig = {
  name?: string;
  logoDataUrl?: string;
};

export type AppConfig = {
  dbMode?: 'sqlite' | 'mysql';
  mysql?: any;
  business?: BusinessConfig;
};

export const getConfig = async (): Promise<AppConfig> => {
  return await window.api.config.get();
};

export const setConfig = async (patch: Partial<AppConfig>) => {
  return await window.api.config.set(patch);
};