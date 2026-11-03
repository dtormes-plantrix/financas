/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  // leitor de fotos HEIC do iPhone (usa WebAssembly); fica fora do empacotamento
  serverExternalPackages: ["heic-decode", "libheif-js", "jpeg-js"],
};

export default nextConfig;
