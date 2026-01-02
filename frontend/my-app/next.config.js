const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para Turbopack (Next.js 16+)
  turbopack: {
    resolveAlias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Mantener webpack para compatibilidad si es necesario
  webpack(config, { isServer }) {
    // Alias para 'src'
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');

    return config;
  },
};

module.exports = nextConfig;
