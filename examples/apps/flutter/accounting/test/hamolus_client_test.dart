// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:hamolus_example_accounting/hamolus_client.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// The record shape these tests use, kept as minimal as possible so they do not change
/// along with the models in `lib/` as they gain fields.
Map<String, dynamic> record(String id) => {'id': id, 'name': 'name-$id'};

void main() {
  group('origin normalisation', () {
    test('adds /api when it is missing', () {
      final client = HamolusClient(origin: 'http://localhost:8787');
      addTearDown(client.close);
      expect(client.apiBase, 'http://localhost:8787/api');
    });

    test('does not add /api twice', () {
      final client = HamolusClient(origin: 'http://localhost:8787/api');
      addTearDown(client.close);
      expect(client.apiBase, 'http://localhost:8787/api');
    });

    test('strips trailing slashes', () {
      final client = HamolusClient(origin: 'http://localhost:8787//');
      addTearDown(client.close);
      expect(client.apiBase, 'http://localhost:8787/api');
    });
  });

  group('listRecords', () {
    test('sends the query, parses data, and reads meta', () async {
      late Uri seen;
      final client = HamolusClient(
        origin: 'http://core.test',
        httpClient: MockClient((request) async {
          seen = request.url;
          return http.Response(
            jsonEncode({
              'data': [
                record('a'),
                record('b'),
              ],
              'meta': {
                'page': 2,
                'pageSize': 2,
                'total': 5,
                'totalPages': 3,
              },
              'lastUpdate': 42,
            }),
            200,
          );
        }),
      );
      addTearDown(client.close);

      final result = await client.listRecords<String>(
        'accounts',
        parse: (json) => json['id'] as String,
        page: 2,
        pageSize: 2,
        sortBy: 'code',
        sortDir: 'asc',
        locale: 'en',
        search: 'cash',
        filter: {'type': const FilterClause('eq', 'asset')},
      );

      expect(seen.path, '/api/accounts');
      expect(seen.queryParameters['page'], '2');
      expect(seen.queryParameters['pageSize'], '2');
      expect(seen.queryParameters['sortBy'], 'code');
      expect(seen.queryParameters['sortDir'], 'asc');
      expect(seen.queryParameters['locale'], 'en');
      expect(seen.queryParameters['search'], 'cash');
      expect(
        jsonDecode(seen.queryParameters['filter']!),
        {
          'type': {'op': 'eq', 'value': 'asset'},
        },
      );

      expect(result.items, ['a', 'b']);
      expect(result.meta.totalPages, 3);
      expect(result.hasNextPage, isTrue);
      expect(result.lastUpdate, 42);
    });

    test('never sends an Authorization header', () async {
      late Map<String, String> seen;
      final client = HamolusClient(
        origin: 'http://core.test',
        httpClient: MockClient((request) async {
          seen = request.headers;
          return http.Response(jsonEncode({'data': [], 'meta': {}}), 200);
        }),
      );
      addTearDown(client.close);

      await client.listRecords<String>('accounts', parse: (json) => json['id'] as String);

      expect(seen.containsKey('authorization'), isFalse);
      expect(seen['accept'], 'application/json');
    });

    test('a core error becomes an exception carrying the code', () async {
      final client = HamolusClient(
        origin: 'http://core.test',
        httpClient: MockClient(
          (_) async => http.Response(
            jsonEncode({
              'error': {'code': 'INVALID_QUERY', 'message': 'unknown sortBy'},
            }),
            400,
          ),
        ),
      );
      addTearDown(client.close);

      await expectLater(
        client.listRecords<String>('accounts', parse: (json) => json['id'] as String),
        throwsA(
          isA<HamolusApiException>()
              .having((error) => error.status, 'status', 400)
              .having((error) => error.code, 'code', 'INVALID_QUERY')
              .having((error) => error.isNetwork, 'isNetwork', isFalse),
        ),
      );
    });
  });

  group('getLocalization', () {
    test('returns the language list from the core', () async {
      final client = HamolusClient(
        origin: 'http://core.test',
        httpClient: MockClient(
          (_) async => http.Response(
            jsonEncode({
              'defaultLocale': 'id',
              'multilingual': true,
              'locales': [
                {'code': 'id', 'label': 'Bahasa Indonesia'},
                {'code': 'en', 'label': 'English', 'direction': 'ltr'},
              ],
            }),
            200,
          ),
        ),
      );
      addTearDown(client.close);

      final resolved = await client.getLocalization();

      expect(resolved, isNotNull);
      expect(resolved!.defaultLocale, 'id');
      expect(resolved.locales.map((entry) => entry.code), ['id', 'en']);
      expect(resolved.multilingual, isTrue);
    });

    test('null on 404, because localization is not configured', () async {
      final client = HamolusClient(
        origin: 'http://core.test',
        httpClient: MockClient((_) async => http.Response('{}', 404)),
      );
      addTearDown(client.close);

      expect(await client.getLocalization(), isNull);
    });

    test('null on an empty language list, without an exception', () async {
      final client = HamolusClient(
        origin: 'http://core.test',
        httpClient: MockClient(
          (_) async => http.Response(
            jsonEncode({'defaultLocale': 'id', 'locales': <dynamic>[]}),
            200,
          ),
        ),
      );
      addTearDown(client.close);

      expect(await client.getLocalization(), isNull);
    });
  });
}
