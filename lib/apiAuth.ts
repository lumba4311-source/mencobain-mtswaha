import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from './supabase';

const ACCESS_TOKEN_COOKIE = 'umbk-access-token';

/**
 * Ambil user yang sedang login dari cookie/header Authorization.
 * Return { id, role } jika valid, null jika tidak ada/expired.
 *
 * Dipakai di semua API routes sebagai guard autentikasi.
 */
export async function getAuthUser(req: NextRequest): Promise<{ id: string; role: string } | null> {
  // Prioritas: Authorization header > cookie
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
    null;

  if (!token) return null;

  const supabase = createSupabaseServerClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Ambil role dari profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return { id: user.id, role: profile.role };
}
