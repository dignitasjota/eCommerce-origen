import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db';

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
        async authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isAdminRoute = nextUrl.pathname.includes('/admin');

            if (isAdminRoute) {
                if (!isLoggedIn) return false;
                const userRole = auth?.user?.role;
                if (userRole !== 'ADMIN' && userRole !== 'ORDER_MANAGER') {
                    return false;
                }
            }

            return true;
        },
    },
});
