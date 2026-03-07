import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type DbMode = 'sqlite' | 'mysql';

export type AppConfig = {
  dbMode: DbMode;
  mysql?: {
    host: string;
    user: string;
    password: string;
    database: string;
  };
};

const getConfigPath = () =>
  path.join(app.getPath('userData'), 'config.json');

export const loadConfig = (): AppConfig => {
  const file = getConfigPath();

  if (!fs.existsSync(file)) {
    const defaultConfig: AppConfig = { dbMode: 'sqlite' };
    fs.writeFileSync(file, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  return JSON.parse(fs.readFileSync(file, 'utf-8'));
};

export const saveConfig = (config: AppConfig): void => {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
};