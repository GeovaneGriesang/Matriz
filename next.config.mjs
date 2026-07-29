const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  // O otimizador de imagem embutido do Next não resolve `src` locais
  // corretamente quando o app roda sob um basePath (self-hosting fora da
  // Vercel) — usamos um loader customizado que aplica o prefixo certo.
  ...(basePath
    ? {
        images: {
          loader: "custom",
          loaderFile: "./image-loader.js",
        },
      }
    : {}),
};

export default nextConfig;
