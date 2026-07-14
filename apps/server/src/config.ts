export interface AppConfig {
  mongodbUri: string;
  anthropicApiKey: string;
  anthropicModel: string;
  port: number;
  webOrigin: string;
  jwtSecret: string;
  adminEmail: string;
  adminPassword: string;
  yookassaShopId: string;
  yookassaSecretKey: string;
  yookassaReturnUrl: string;
  embeddingModel: string;
  nodeEnv: string;
}

export function loadConfig(): AppConfig {
  const required = (key: string): string => {
    const v = process.env[key];
    if (!v) throw new Error(`Missing env: ${key}`);
    return v;
  };

  return {
    mongodbUri: required('MONGODB_URI'),
    anthropicApiKey: required('ANTHROPIC_API_KEY'),
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    port: Number(process.env.PORT ?? 3001),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
    adminEmail: process.env.ADMIN_EMAIL ?? 'admin@sofipark.ru',
    adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
    yookassaShopId: process.env.YOOKASSA_SHOP_ID ?? '',
    yookassaSecretKey: process.env.YOOKASSA_SECRET_KEY ?? '',
    yookassaReturnUrl: process.env.YOOKASSA_RETURN_URL ?? 'http://localhost:5173/?payment=success',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'Xenova/multilingual-e5-small',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}
