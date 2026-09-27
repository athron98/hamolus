// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/// REST client for the Hamolus core.
///
/// The Dart counterpart of `src/lib/hamolus.ts` in the site examples, with three
/// differences that come from the medium: an explicit timeout, cancellation, and errors
/// thrown as catchable exceptions.
///
/// Three rules hold here:
///
/// 1. **Never send an `Authorization` header.** The core auth middleware demands a valid
///    JWT as soon as that header appears. Sending it without a token breaks a request that
///    would otherwise succeed. This app only reads public endpoints.
/// 2. **The base URL is normalised once.** `http://host:8787` and `http://host:8787/api`
///    should produce the same result, so configuration is hard to get wrong.
/// 3. **Queries are encoded through [Uri], not concatenated by hand.** Collection names
///    and filter values can contain characters that need escaping; manual assembly
///    produces broken URLs with no warning.
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// One language, as the core declares it.
class LocaleDefinition {
  const LocaleDefinition({required this.code, this.label, this.direction = 'ltr'});

  final String code;
  final String? label;
  final String direction;

  factory LocaleDefinition.fromJson(Map<String, dynamic> json) {
    return LocaleDefinition(
      code: json['code'] as String,
      label: json['label'] as String?,
      direction: json['direction'] as String? ?? 'ltr',
    );
  }
}

/// Shape of `GET /_meta/localization`. The language list belongs to the core, not to the app.
class ResolvedLocalization {
  const ResolvedLocalization({
    required this.defaultLocale,
    required this.locales,
    required this.multilingual,
  });

  final String defaultLocale;
  final List<LocaleDefinition> locales;
  final bool multilingual;

  /// Parse the localization response, or `null` when the core has no usable language yet.
  ///
  /// Two conditions make this `null` rather than an exception: an empty `locales` list, and
  /// a missing `defaultLocale` together with an equally empty list. Both are normal for a
  /// freshly configured core, and neither should take the app down — the caller simply
  /// falls back to the locale from its own configuration.
  static ResolvedLocalization? tryParse(Map<String, dynamic> json) {
    final raw = (json['locales'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(LocaleDefinition.fromJson)
        .toList();
    if (raw.isEmpty) return null;

    return ResolvedLocalization(
      defaultLocale: json['defaultLocale'] as String? ?? raw.first.code,
      locales: raw,
      multilingual: json['multilingual'] as bool? ?? raw.length > 1,
    );
  }
}

/// Pagination envelope, mirroring `PaginationMeta` in `@hamolus/types`.
class PaginationMeta {
  const PaginationMeta({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) {
    return PaginationMeta(
      page: json['page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? 20,
      total: json['total'] as int? ?? 0,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

/// The result of one list request.
class Paged<T> {
  const Paged({required this.items, required this.meta, required this.lastUpdate});

  final List<T> items;
  final PaginationMeta meta;

  /// Hash of the last change. Useful for deciding the local cache state, not for display.
  final int lastUpdate;

  bool get hasNextPage => meta.page < meta.totalPages;
}

/// One filter clause. Operators the core supports: eq, neq, gt, gte, lt, lte, like, in,
/// contains.
class FilterClause {
  const FilterClause(this.op, this.value);

  final String op;
  final Object? value;

  Map<String, dynamic> toJson() => {'op': op, 'value': value};
}

/// Per-field filter map, e.g. `{'status': FilterClause('eq', 'published')}`.
typedef FilterMap = Map<String, FilterClause>;

/// An error that carries information from the core, not just an HTTP status.
class HamolusApiException implements Exception {
  HamolusApiException(this.status, this.code, this.message);

  final int status;
  final String code;
  final String message;

  /// `true` when this is a network problem rather than a data problem. Those are usually
  /// the ones worth retrying; the rest are not.
  bool get isNetwork => status == 0;

  @override
  String toString() => 'HamolusApiException($status, $code): $message';
}

/// [HamolusClient] is the only place in this example that performs I/O.
class HamolusClient {
  HamolusClient({
    String? origin,
    String? locale,
    this.timeout = const Duration(seconds: 15),
    http.Client? httpClient,
  })  : _origin = _normalizeOrigin(origin ?? _constOrigin),
        _locale = locale ?? _constLocale,
        _http = httpClient ?? http.Client();

  /// This value is read at compile time through `--dart-define`, so it ends up inlined in
  /// the binary. That is fine for a public core URL; never use the same prefix for
  /// secrets.
  static const _constOrigin =
      String.fromEnvironment('HAMOLUS_API_ORIGIN', defaultValue: 'http://localhost:8787');
  static const _constLocale =
      String.fromEnvironment('HAMOLUS_LOCALE', defaultValue: 'id');

  final String _origin;
  final String _locale;
  final Duration timeout;
  final http.Client _http;

  static String _normalizeOrigin(String raw) {
    var value = raw.replaceAll(RegExp(r'/+$'), '');
    if (!value.endsWith('/api')) {
      value = '$value/api';
    }
    return value;
  }

  String get locale => _locale;

  /// The final base URL every request uses, `/api` included.
  ///
  /// Exposed so tests can assert it without guessing the URL shape, and so the value shown
  /// while debugging is exactly the one sent to the core.
  String get apiBase => _origin;

  /// The core's language list.
  ///
  /// This endpoint is public and answers 404 when the core has no localization configured.
  /// That is a normal state, so [getLocalization] returns `null` and the caller uses the
  /// locale from its own app configuration.
  Future<ResolvedLocalization?> getLocalization() async {
    try {
      final body = await _request('/_meta/localization');
      return ResolvedLocalization.tryParse(body);
    } on HamolusApiException {
      // This endpoint is public and only picks a locale. A core without localization
      // configured answers 404; that is not an application failure.
      return null;
    }
  }

  /// The records of one collection.
  ///
  /// `parse` is required: this client does not guess the shape of a record. Every
  /// collection has its own shape, and making the caller name it keeps that assumption in
  /// one place instead of scattered across widgets.
  Future<Paged<T>> listRecords<T>(
    String collection, {
    required T Function(Map<String, dynamic>) parse,
    int page = 1,
    int pageSize = 20,
    String? sortBy,
    String sortDir = 'desc',
    FilterMap? filter,
    String? search,
    String? locale,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'pageSize': '$pageSize',
      'sortDir': sortDir,
      'locale': locale ?? _locale,
      if (sortBy != null) 'sortBy': sortBy,
      if (search != null && search.isNotEmpty) 'search': search,
      if (filter != null && filter.isNotEmpty)
        'filter': jsonEncode(filter.map((key, value) => MapEntry(key, value.toJson()))),
    };

    final body = await _request('/$collection', query: query);
    final data = (body['data'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(parse)
        .toList();

    return Paged<T>(
      items: data,
      meta: PaginationMeta.fromJson(body['meta'] as Map<String, dynamic>? ?? const {}),
      lastUpdate: (body['lastUpdate'] as num?)?.toInt() ?? 0,
    );
  }

  /// A single record by **id**, not by slug. The core route is `/api/{collection}/{id}`.
  Future<T> getRecord<T>(
    String collection,
    String id,
    T Function(Map<String, dynamic>) parse,
  ) async {
    final body = await _request('/$collection/${Uri.encodeComponent(id)}');
    final data = body['data'];
    if (data is! Map<String, dynamic>) {
      throw HamolusApiException(
        0,
        'MALFORMED',
        'Record $collection/$id is not a JSON object',
      );
    }
    return parse(data);
  }

  Future<Map<String, dynamic>> _request(
    String path, {
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse('$_origin$path').replace(queryParameters: query);

    // See rule (1) above: the Authorization header is never sent.
    final response = await _http
        .get(uri, headers: const {'accept': 'application/json'})
        .timeout(timeout);

    final text = response.body;
    final body = text.isEmpty ? null : jsonDecode(text);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = body is Map<String, dynamic> ? body['error'] : null;
      throw HamolusApiException(
        response.statusCode,
        error is Map<String, dynamic> ? error['code'] as String? ?? 'UNKNOWN' : 'UNKNOWN',
        error is Map<String, dynamic>
            ? error['message'] as String? ?? 'HTTP ${response.statusCode}'
            : 'HTTP ${response.statusCode}',
      );
    }

    if (body is! Map<String, dynamic>) {
      throw HamolusApiException(0, 'MALFORMED', 'Response for $path is not a JSON object');
    }
    return body;
  }

  /// Close the connection. Called when the app exits; Flutter has no built-in `dispose`,
  /// so whoever owns this client is responsible for it.
  void close() => _http.close();
}
