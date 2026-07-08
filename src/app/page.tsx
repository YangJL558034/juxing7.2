import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('auth_token');

  if (!authCookie?.value) {
    redirect('/login');
  }

  const user = await getCurrentUser(cookieStore.toString());

  if (!user || !user.id) {
    redirect('/login');
  }

  return <MainLayout user={user} />;
}
