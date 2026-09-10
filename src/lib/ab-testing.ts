import type { Prisma, PrismaClient } from '@prisma/client';

export const AB_HERO_COOKIE = 'eshop_ab_hero';
export const AB_HERO_TEST_KEY = 'home_hero';

export type AbVariant = 'A' | 'B';

export function isAbVariant(value: unknown): value is AbVariant {
    return value === 'A' || value === 'B';
}

export interface HeroAbSettings {
    enabled: boolean;
    variantBTitle: string | null;
    variantBSubtitle: string | null;
    variantBButton: string | null;
}

export async function getHeroAbSettings(db: PrismaClient | Prisma.TransactionClient): Promise<HeroAbSettings> {
    const rows = await db.siteSetting.findMany({
        where: { key: { in: ['ab_hero_enabled', 'ab_hero_b_title', 'ab_hero_b_subtitle', 'ab_hero_b_button'] } }
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return {
        enabled: map['ab_hero_enabled'] === 'true',
        variantBTitle: map['ab_hero_b_title'] || null,
        variantBSubtitle: map['ab_hero_b_subtitle'] || null,
        variantBButton: map['ab_hero_b_button'] || null
    };
}

/**
 * Recuento de impresiones/clicks por variante para el resumen en
 * /admin/settings. Sólo lectura — no se usa para servir la variante (eso
 * lo decide la cookie asignada en middleware.ts).
 */
export async function getHeroAbStats(db: PrismaClient) {
    const rows = await db.abTestEvent.groupBy({
        by: ['variant', 'event_type'],
        where: { test_key: AB_HERO_TEST_KEY },
        _count: { _all: true }
    });

    const stats: Record<AbVariant, { impressions: number; clicks: number }> = {
        A: { impressions: 0, clicks: 0 },
        B: { impressions: 0, clicks: 0 }
    };

    for (const row of rows) {
        if (!isAbVariant(row.variant)) continue;
        if (row.event_type === 'impression') stats[row.variant].impressions = row._count._all;
        if (row.event_type === 'click') stats[row.variant].clicks = row._count._all;
    }

    return stats;
}
