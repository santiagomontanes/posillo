export type BusinessConfig = {
  name?: string;
  logoDataUrl?: string;
  nit?: string;
  phone?: string;
};

export type BusinessProfileConfig = {
  businessName?: string;
  businessTagline?: string;
  logoDataUrl?: string;
  nit?: string;
  phone?: string;
};

export type AppConfig = {
  dbMode?: 'sqlite' | 'mysql';
  mysql?: any;
  business?: BusinessConfig;
  businessProfile?: BusinessProfileConfig;
};

export const getConfig = async (): Promise<AppConfig> => {
  return await window.api.config.get();
};

export const setConfig = async (patch: Partial<AppConfig>) => {
  return await window.api.config.set(patch);
};