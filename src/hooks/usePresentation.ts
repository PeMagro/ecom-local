import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CHANNELS, type PresentationChannel } from '@/lib/presentation-channels';
import { loadDemo, type DemoState } from '@/lib/ml-demo';

type ConnectedChannel = DemoState & { marketplace: PresentationChannel };
export function usePresentation() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<{ userId: string | null; channels: ConnectedChannel[] }>({ userId: null, channels: [] });
  useEffect(() => {
    const update = () => setSnapshot({ userId: user?.id ?? null, channels: user ? CHANNELS.flatMap(c => {
      const state = loadDemo(user.id, undefined, c.id);
      return state ? [{ ...state, marketplace: c.id }] : [];
    }) : [] });
    update();
    window.addEventListener('ecom:channels-changed', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('ecom:channels-changed', update); window.removeEventListener('storage', update); };
  }, [user?.id]);
  const channels = snapshot.userId === user?.id ? snapshot.channels : [];
  return {
    ready: snapshot.userId === (user?.id ?? null), channels,
    listings: channels.flatMap(c => c.listings.map(l => ({ ...l, marketplace: c.marketplace }))),
    orders: channels.flatMap(c => c.orders ?? []),
  };
}
