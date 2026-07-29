const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Loader customizado do next/image usado só quando NEXT_PUBLIC_BASE_PATH
 * está definido (self-hosting fora da raiz do domínio) — ver next.config.mjs.
 * Sem otimização (serve o arquivo original), só corrige o prefixo do src.
 */
export default function customImageLoader({ src }) {
  return src.startsWith(basePath) ? src : `${basePath}${src}`;
}
