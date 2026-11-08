export interface AppEnv {
  readonly apiBaseUrl: string;
}

export function readAppEnv(source: Readonly<Record<string, string | undefined>>): AppEnv {
  const apiBaseUrl = source.VITE_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error(`VITE_API_BASE_URL wajib diisi.`);
  }

  let url: URL;

  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error(`VITE_API_BASE_URL tidak valid: ${apiBaseUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`VITE_API_BASE_URL harus memakai http atau https: ${apiBaseUrl}`);
  }

  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, '') };
}

export const appEnv = readAppEnv(import.meta.env);
