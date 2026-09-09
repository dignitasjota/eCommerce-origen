import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db';
import { ADMIN_ROLES, type AdminRole } from '@/lib/auth-roles';
import { rateLimit } from '@/lib/rate-limit';

/**
 * `code` queda en la URL de error (`?error=CredentialsSignin&code=...`) — el
 * login page lo usa para distinguir "demasiados intentos" de "credenciales
 * incorrectas" sin filtrar cuál de las dos fue exactamente por seguridad.
 */
class TooManyAttemptsError extends CredentialsSignin {
    code = 'too_many_attempts';
}

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
    // El despliegue documentado (CLAUDE.md §2) corre detrás de un reverse
    // proxy externo (Traefik/Caddy/nginx-proxy-manager) que termina TLS y
    // reenvía por HTTP interno con X-Forwarded-*. Sin trustHost, Auth.js v5
    // puede lanzar UntrustedHost o inferir mal host/protocolo en producción.
    trustHost: true,
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
            async authorize(credentials, request) {
                // Sin esto, el login era el único endpoint de auth sin
                // rate-limit — register/forgot-password/reset-password sí lo
                // tenían, pero el propio `signIn('credentials')` (el que de
                // verdad importa para fuerza bruta de contraseñas contra una
                // cuenta conocida) no tenía ningún límite de intentos.
                const limit = rateLimit(request, { bucket: 'login', max: 5, windowMs: 15 * 60_000 });
                if (!limit.ok) {
                    throw new TooManyAttemptsError();
                }

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
