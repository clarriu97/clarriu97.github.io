#!/usr/bin/env node

if (!/pnpm/.test(process.env.npm_execpath || '')) {
    console.warn(
        '\n\x1b[33m⚠️  Este proyecto usa pnpm como gestor de paquetes.\x1b[0m\n' +
        '\x1b[31m❌ Por favor usa "pnpm install" en lugar de "npm install" o "yarn install"\x1b[0m\n' +
        '\n\x1b[36mSi no tienes pnpm instalado, ejecuta:\x1b[0m\n' +
        '\x1b[32m   npm install -g pnpm\x1b[0m\n'
    );
    process.exit(1);
}
