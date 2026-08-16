import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { router } from 'expo-router';

export default function AppLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  if (loading) return null;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Minhas Entregas' }} />
      <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
      <Stack.Screen name="nova-entrega" options={{ title: 'Nova Entrega' }} />
      <Stack.Screen name="entrega/[id]" options={{ title: 'Detalhes' }} />
      <Stack.Screen name="resumo" options={{ title: 'Resumo do Dia' }} />
    </Stack>
  );
}
