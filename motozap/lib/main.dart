import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/setup_screen.dart';
import 'screens/main_scaffold.dart';

void main() {
  runApp(const MotoZapApp());
}

class MotoZapApp extends StatelessWidget {
  const MotoZapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MotoZap',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFFF6B00),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const _Root(),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool? _configured;

  @override
  void initState() {
    super.initState();
    _checkConfig();
  }

  Future<void> _checkConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final whatsapp = prefs.getString('whatsapp');
    setState(() {
      _configured = whatsapp != null && whatsapp.isNotEmpty;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_configured == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return _configured! ? const MainScaffold() : const SetupScreen();
  }
}