import 'dart:async';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import '../models/delivery_order.dart';

class DatabaseService {
  static Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'motozap.db');
    _db = await openDatabase(
      path,
      version: 6,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE orders (
            id TEXT PRIMARY KEY,
            order_number TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT,
            address TEXT NOT NULL,
            complement TEXT,
            neighborhood TEXT,
            reference TEXT,
            payment_method TEXT,
            scheduled_for TEXT,
            amount REAL NOT NULL,
            already_paid INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL,
            delivery_fee REAL NOT NULL DEFAULT 0,
            discount REAL NOT NULL DEFAULT 0,
            cashback REAL NOT NULL DEFAULT 0,
            change_for TEXT,
            item_count INTEGER NOT NULL DEFAULT 0,
            items_summary TEXT,
            observation TEXT,
            order_date_time TEXT,
            manual_annotation TEXT,
            photo_path TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE pending_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            status TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL,
            delivered INTEGER NOT NULL DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE daily_counts (
            date TEXT PRIMARY KEY,
            count INTEGER NOT NULL
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('ALTER TABLE orders ADD COLUMN complement TEXT');
        }
        if (oldVersion < 3) {
          await db.execute('ALTER TABLE orders ADD COLUMN reference TEXT');
          await db.execute('ALTER TABLE orders ADD COLUMN payment_method TEXT');
          await db.execute('ALTER TABLE orders ADD COLUMN scheduled_for TEXT');
        }
        if (oldVersion < 4) {
          await db.execute('ALTER TABLE orders ADD COLUMN neighborhood TEXT');
        }
        if (oldVersion < 5) {
          await db.execute('ALTER TABLE orders ADD COLUMN delivery_fee REAL NOT NULL DEFAULT 0');
          await db.execute('ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0');
          await db.execute('ALTER TABLE orders ADD COLUMN cashback REAL NOT NULL DEFAULT 0');
          await db.execute('ALTER TABLE orders ADD COLUMN change_for TEXT');
          await db.execute('ALTER TABLE orders ADD COLUMN item_count INTEGER NOT NULL DEFAULT 0');
          await db.execute('ALTER TABLE orders ADD COLUMN items_summary TEXT');
          await db.execute('ALTER TABLE orders ADD COLUMN observation TEXT');
          await db.execute('ALTER TABLE orders ADD COLUMN order_date_time TEXT');
          await db.execute('ALTER TABLE orders ADD COLUMN manual_annotation TEXT');
        }
        if (oldVersion < 6) {
          await db.execute('ALTER TABLE orders ADD COLUMN photo_path TEXT');
        }
      },
    );
    return _db!;
  }

  Future<void> insertOrder(DeliveryOrder o) async {
    final db = await database;
    await db.insert('orders', o.toMap());
  }

  Future<List<DeliveryOrder>> listPendingOrders() async {
    final db = await database;
    final rows = await db.query(
      'orders',
      where: 'status != ?',
      whereArgs: ['route_finished'],
      orderBy: 'created_at DESC',
    );
    return rows.map(DeliveryOrder.fromMap).toList();
  }

  Future<List<DeliveryOrder>> listCompletedToday() async {
    final db = await database;
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day).toIso8601String();
    final end = DateTime(today.year, today.month, today.day + 1).toIso8601String();
    final rows = await db.query(
      'orders',
      where: 'status = ? AND created_at >= ? AND created_at < ?',
      whereArgs: ['route_finished', start, end],
      orderBy: 'created_at DESC',
    );
    return rows.map(DeliveryOrder.fromMap).toList();
  }

  Future<List<DeliveryOrder>> listAllOrders({int? limit}) async {
    final db = await database;
    final rows = await db.query(
      'orders',
      where: 'status = ?',
      whereArgs: ['route_finished'],
      orderBy: 'created_at DESC',
      limit: limit,
    );
    return rows.map(DeliveryOrder.fromMap).toList();
  }

  Future<void> updateOrderStatus(String id, String status) async {
    final db = await database;
    await db.update(
      'orders',
      {'status': status},
      where: 'id = ?',
      whereArgs: [id],
    );
    if (status == 'route_finished') {
      await _incrementDailyCount();
    }
  }

  Future<void> _incrementDailyCount() async {
    final db = await database;
    final today = DateTime.now();
    final key =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    await db.rawInsert(
      'INSERT OR IGNORE INTO daily_counts (date, count) VALUES (?, 0)',
      [key],
    );
    await db.rawUpdate(
      'UPDATE daily_counts SET count = count + 1 WHERE date = ?',
      [key],
    );
  }

  Future<int> getTodayCount() async {
    final db = await database;
    final today = DateTime.now();
    final key =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final rows = await db.query(
      'daily_counts',
      where: 'date = ?',
      whereArgs: [key],
    );
    if (rows.isEmpty) return 0;
    return (rows.first['count'] as int?) ?? 0;
  }

  Future<int> queueMessage(
      String orderId, String status, String? note) async {
    final db = await database;
    return db.insert('pending_messages', {
      'order_id': orderId,
      'status': status,
      'note': note,
      'created_at': DateTime.now().toIso8601String(),
      'delivered': 0,
    });
  }

  Future<List<Map<String, Object?>>> listPendingMessages() async {
    final db = await database;
    return db.query(
      'pending_messages',
      where: 'delivered = 0',
      orderBy: 'id ASC',
    );
  }

  Future<void> markMessageDelivered(int id) async {
    final db = await database;
    await db.update(
      'pending_messages',
      {'delivered': 1},
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}