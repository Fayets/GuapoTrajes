const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    // Alias para 'src'
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');

    return config;
  },
};

module.exports = nextConfig;
