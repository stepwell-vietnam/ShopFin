// Admin helper — hardcoded single admin
import { Session } from 'next-auth';

export const ADMIN_EMAIL = 'duongbirken@gmail.com';

export function isAdmin(session: Session | null): boolean {
    return session?.user?.email === ADMIN_EMAIL;
}

export function isAdminEmail(email: string | null | undefined): boolean {
    return email === ADMIN_EMAIL;
}
