import type { Prisma } from '@prisma/client';

/**
 * Tipos derivados de los `include` reales que usan las páginas del admin.
 *
 * Centralizar los `Prisma.GetPayload` aquí evita el patrón `any[]` esparcido
 * en los managers, permite que TS detecte regresiones cuando alguien cambia
 * la query de la página, y deja claro qué campos están garantizados.
 */

// ── Products ──────────────────────────────────────────────────────────────

const productAdminInclude = {
    product_translations: { where: { locale: 'es' } },
    product_categories: {
        include: {
            categories: {
                include: { category_translations: { where: { locale: 'es' } } }
            }
        }
    },
    product_variants: true,
    product_images: { orderBy: { sort_order: 'asc' as const } },
    related_to: true
} satisfies Prisma.ProductInclude;

export type AdminProduct = Prisma.ProductGetPayload<{ include: typeof productAdminInclude }>;

// ── Categories ────────────────────────────────────────────────────────────

const categoryAdminInclude = {
    category_translations: { where: { locale: 'es' } },
    other_categories: {
        include: { category_translations: { where: { locale: 'es' } } }
    },
    _count: { select: { product_categories: true } }
} satisfies Prisma.CategoryInclude;

export type AdminCategory = Prisma.CategoryGetPayload<{ include: typeof categoryAdminInclude }>;

// ── Users ─────────────────────────────────────────────────────────────────

const userAdminSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    phone: true,
    created_at: true,
    _count: { select: { orders: true } },
    addresses: { where: { is_default: true }, take: 1 }
} satisfies Prisma.UserSelect;

export type AdminUser = Prisma.UserGetPayload<{ select: typeof userAdminSelect }>;

// ── Orders (listado) ──────────────────────────────────────────────────────

const orderListInclude = {
    users: { select: { name: true, email: true } },
    order_items: { select: { id: true } },
    shipping_methods: {
        include: { shipping_method_translations: { where: { locale: 'es' } } }
    }
} satisfies Prisma.OrderInclude;

export type AdminOrderListItem = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;

// ── Blog posts ────────────────────────────────────────────────────────────

const blogAdminInclude = {
    blog_post_translations: { where: { locale: 'es' } }
} satisfies Prisma.BlogPostInclude;

export type AdminBlogPost = Prisma.BlogPostGetPayload<{ include: typeof blogAdminInclude }>;
