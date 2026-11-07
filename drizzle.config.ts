import { defineConfig } from 'drizzle-kit';
import { loadAppConfig } from './src/config/app-config';
import { buildConnectionString } from './src/shared/infrastructure/database/client';

// drizzle-kit dijalankan lewat script `bun db:*` yang sudah memuat file env
// environment terkait, jadi konfigurasi database mengikuti environment aplikasi.
const appConfig = loadAppConfig();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: buildConnectionString(appConfig.database)
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public'
  },
  strict: true,
  verbose: appConfig.environment === 'development'
});
