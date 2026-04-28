import { useAuthStore } from '@/stores/auth';

import { apiClient } from './client';

const ANIMALS = [
  'otter',
  'fox',
  'wolf',
  'badger',
  'falcon',
  'koala',
  'lynx',
  'raven',
  'tiger',
  'jaguar',
  'gecko',
  'orca',
  'narwhal',
  'condor',
  'cougar',
  'panda',
];

interface GuestNameOptions {
  prefix?: string;
}

export function generateGuestName(opts?: GuestNameOptions): string {
  const prefix = opts?.prefix ?? import.meta.env.VITE_GUEST_NAME_PREFIX ?? 'anonymous-';
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] ?? 'otter';
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${animal}-${suffix}`;
}

interface CreateUserResponse {
  id: string;
  display_name: string;
  api_key: string;
}

export async function ensureGuestUser(): Promise<void> {
  const existing = useAuthStore.getState().apiKey;
  if (existing) return;

  const display_name = generateGuestName();
  const created = await apiClient.post<CreateUserResponse>(
    '/v1/users',
    { display_name },
    { skipAuth: true },
  );

  useAuthStore.getState().setKey(created.api_key, created.id, created.display_name);
}
