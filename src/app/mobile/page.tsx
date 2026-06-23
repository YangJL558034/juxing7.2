import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MobileSystemShell from '@/components/mobile/MobileSystemShell';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MobilePage() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('auth_token');

  if (!authCookie?.value) {
    redirect('/login?next=/mobile');
  }

  const user = await verifyToken(authCookie.value);

  if (!user || !user.id) {
    redirect('/login?next=/mobile');
  }

  return <MobileSystemShell user={user} />;
}
