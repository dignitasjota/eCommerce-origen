import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Todas las páginas normales
        const pages = await prisma.page.findMany({
            include: { page_translations: { select: { locale: true, title: true } } }
        });

        // 2. Intentar findUnique con el slug de la primera página
        let findUniqueResult = null;
        let findFirstResult = null;
        if (pages.length > 0) {
            const testSlug = pages[0].slug;
            findUniqueResult = await prisma.page.findUnique({
                where: { slug: testSlug },
                include: { page_translations: true }
            });
            findFirstResult = await prisma.page.findFirst({
                where: { slug: testSlug },
                include: { page_translations: true }
            });
        }

        // 3. Todas las páginas legales (para comparar)
        const legalPages = await prisma.legalPage.findMany({
            include: { legal_page_translations: { select: { locale: true, title: true } } }
        });

        // 4. pages_prefix setting
        const prefix = await prisma.siteSetting.findUnique({
            where: { key: 'pages_prefix' }
        });

        return NextResponse.json({
            pages,
            findUniqueResult: findUniqueResult ? 'OK - found' : 'FAIL - null',
            findFirstResult: findFirstResult ? 'OK - found' : 'FAIL - null',
            legalPages,
            pagesPrefix: prefix,
            testSlug: pages[0]?.slug || 'NO PAGES',
        }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5),
        }, { status: 500 });
    }
}
