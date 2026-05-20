import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 requiere un archivo de configuración separado para algunas
 * herramientas (migrate diff, etc.). Este archivo lee `.env` y reexporta
 * la datasource para que `--from-config-datasource` funcione.
 *
 * No afecta al runtime — solo a las CLIs de Prisma.
 */
export default defineConfig({
    schema: path.join('prisma', 'schema.prisma'),
    datasource: {
        url: process.env.DATABASE_URL!
    }
});
