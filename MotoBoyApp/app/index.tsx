import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, loading, usuario } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (usuario?.tipo === 'lojista') {
      router.replace('/lojista');
    } else {
      router.replace('/(app)');
    }
  }, [user, loading, usuario]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <ActivityIndicator color="#FF6B00" size="large" />
    </View>
  );
}
