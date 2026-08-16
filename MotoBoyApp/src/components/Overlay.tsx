// Overlay CSS-only — substitui <Modal> do react-native-web pra evitar
// o bug "removeChild" que o Modal nativo tem com hot-reload / React 18+19.
//
// IMPORTANTE: react-native-web FILTRA valores de `position` no StyleSheet.create
// e descarta 'fixed' silenciosamente. Pra aplicar `position: fixed` na web,
// precisamos usar `style` inline direto no JSX (que passa pelo filtro menos
// restritivo) ou usar `dangerouslySetInnerHTML` style. Aqui usamos inline.
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const baseBg: any = {
  position: 'fixed' as any,
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'flex-end',
  zIndex: 9999,
};

export default function Overlay({ visible, onClose, children, style }: Props) {
  if (!visible) return null;
  return (
    <View style={{ ...baseBg, ...style }} onStartShouldSetResponder={() => true}>
      <Pressable style={styles.dismiss} onPress={onClose} />
      <View style={styles.sheet} onStartShouldSetResponder={() => true}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: { width: '100%', backgroundColor: 'transparent' },
});
