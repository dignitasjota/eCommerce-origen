import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db';
import { ADMIN_ROLES, type AdminRole } from '@/lib/auth-roles';

export { ADMIN_ROLES, type AdminRole };

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string | null;
            role: string;
            image: string | null;
        };
    }
    interface User {
        role: string;
    }
}

declare module '@auth/core/jwt' {
    interface JWT {
        id: string;
        role: string;
    }
}

export class AuthorizationError extends Error {
    constructor(message = 'No autorizado') {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma) as any,
    session: { strategy: 'jwt' },
    pages: {
        signIn: '/auth/login',
        error: '/auth/error',
    },
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user || !user.password_hash) {
                    return null;
                }

                const isPasswordValid = await compare(
                    credentials.password as string,
                    user.password_hash
                );

                if (!isPasswordValid) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id as string;
                token.role = user.role as string;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
            }
            return session;
        },
        // Nota: la protección de rutas /admin/* NO se hace con un callback
        // `authorized` aquí, porque eso exigiría que src/middleware.ts envuelva
        // con `auth()` — lo que arrastraría el PrismaAdapter (y el driver de
        // MariaDB) al bundle del middleware. En su lugar, src/middleware.ts
        // decodifica el JWT de sesión directamente con `getToken()` de
        // `next-auth/jwt`, que no depende del adapter.
    },
});

/**
 * Garantiza que la sesión actual pertenece a un usuario con permisos de admin.
 * Lanzar AuthorizationError aquí evita exponer detalles del error al cliente
 * y permite a Next.js convertirlo en un fallo controlado de la server action.
 *
 * @param allowedRoles roles aceptados; por defecto cualquier admin (ADMIN | ORDER_MANAGER).
 * @returns la sesión validada con `user.id` y `user.role` no nulos.
 */
export async function requireAdmin(allowedRoles: readonly AdminRole[] = ADMIN_ROLES) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new AuthorizationError('Sesión no válida');
    }

    const role = session.user.role as AdminRole | undefined;
    if (!role || !allowedRoles.includes(role)) {
        throw new AuthorizationError('Permisos insuficientes');
    }

    return session as typeof session & {
        user: { id: string; email: string; role: AdminRole; name: string | null; image: string | null };
    };
}
