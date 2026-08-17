import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { WebHead } from '../src/components/WebHead';
import { preloadCoordenadasLoja } from '../src/services/geolocation';

// Pré-carrega coordenadas da loja em background
preloadCoordenadasLoja();

function ThemedRoot() {
  const { mode, colors } = useTheme();
  const paperTheme = mode === 'dark'
    ? {
        ...MD3DarkTheme,
        colors: {
          ...MD3DarkTheme.colors,
          primary: '#FF6B00',
          secondary: '#FFB800',
          background: colors.bg,
          surface: colors.surface,
        },
      }
    : {
        ...MD3LightTheme,
        colors: {
          ...MD3LightTheme.colors,
          primary: '#FF6B00',
          secondary: '#FFB800',
          background: colors.bg,
          surface: colors.surface,
        },
      };

  return (
    <PaperProvider theme={paperTheme} settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}>
      <WebHead />
      <AuthProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="codigo" options={{ title: 'Painel Lojista', headerShown: false }} />
          <Stack.Screen name="painel" options={{ title: 'Meus Pedidos' }} />
          <Stack.Screen name="painel-lojista" options={{ title: 'Painel Lojista' }} />
          <Stack.Screen name="painel-motoboy" options={{ title: 'Minhas Lojas' }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="lojista" options={{ title: 'Painel da Loja' }} />
        </Stack>
      </AuthProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}
