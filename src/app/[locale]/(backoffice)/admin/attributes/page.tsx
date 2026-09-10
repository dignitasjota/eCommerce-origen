import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { hasPermission } from '@/lib/auth';
import AttributesManager from './AttributesManager';

export default async function AttributesPage() {
    if (!(await hasPermission('products.manage'))) notFound();

    const types = await prisma.variantType.findMany({
        orderBy: { slug: 'asc' },
        include: {
            variant_type_translations: { where: { locale: 'es' } },
            variant_options: {
                orderBy: { sort_order: 'asc' },
                include: { variant_option_translations: { where: { locale: 'es' } } }
            }
        }
    });

    const formatted = types.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.variant_type_translations[0]?.name || t.slug,
        options: t.variant_options.map((o) => ({
            id: o.id,
            slug: o.slug,
            value: o.variant_option_translations[0]?.value || o.slug
        }))
    }));

    return <AttributesManager initialTypes={formatted} />;
}
