// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/// Data layer for the accounting domain.
///
/// This file knows the shape of its data; it knows neither HTTP nor Flutter.
/// [HamolusClient] knows the transport and the widgets know the presentation. That
/// separation is what makes API calls testable without a widget tree.
library;

import 'hamolus_client.dart';

/// The five kinds of account in accounting. The string values have to match what the
/// core stores, because filters are sent as-is.
enum AccountType {
  asset('asset'),
  liability('liability'),
  equity('equity'),
  revenue('revenue'),
  expense('expense');

  const AccountType(this.wire);

  /// The value sent to the core.
  final String wire;

  static AccountType fromWire(Object? value) {
    return AccountType.values.firstWhere(
      (type) => type.wire == value,
      // An unknown type is treated as an asset so the page still renders. Guessing is
      // easier to trace down than letting rows vanish from the view.
      orElse: () => AccountType.asset,
    );
  }
}

/// One ledger account.
class Account {
  const Account({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
  });

  final String id;
  final String code;
  final String name;
  final AccountType type;

  /// The value used when the core returns nothing for a field.
  ///
  /// The fields here are deliberately total: every one has a fallback. A core record can
  /// lose fields when the collection schema changes, and an accounting app that fails to
  /// start because one journal row has no `description` is worse than one that shows that
  /// row with no description.
  factory Account.fromJson(Map<String, dynamic> json) {
    return Account(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '-',
      name: json['name'] as String? ?? '(no name)',
      type: AccountType.fromWire(json['type']),
    );
  }
}

/// One journal line: a single account inside a single entry.
class JournalEntry {
  const JournalEntry({
    required this.id,
    required this.entryNo,
    required this.entryDate,
    required this.description,
    required this.accountId,
    required this.debit,
    required this.credit,
    required this.currency,
  });

  final String id;
  final String entryNo;
  final String entryDate;
  final String description;
  final String accountId;
  final double debit;
  final double credit;
  final String currency;

  /// Debit minus credit. For a balanced entry each line is not necessarily zero on its
  /// own — what adds up is the whole set of lines in the entry.
  double get balance => debit - credit;

  bool get isDebit => debit > 0;

  factory JournalEntry.fromJson(Map<String, dynamic> json) {
    return JournalEntry(
      id: json['id'] as String? ?? '',
      entryNo: json['entry_no'] as String? ?? '-',
      entryDate: json['entry_date'] as String? ?? '',
      description: json['description'] as String? ?? '',
      accountId: json['account_id'] as String? ?? '',
      debit: (json['debit'] as num?)?.toDouble() ?? 0,
      credit: (json['credit'] as num?)?.toDouble() ?? 0,
      currency: json['currency'] as String? ?? 'IDR',
    );
  }
}

/// One invoice.
class Invoice {
  const Invoice({
    required this.id,
    required this.invoiceNo,
    required this.issuedAt,
    required this.dueAt,
    required this.clientName,
    required this.total,
    required this.status,
  });

  final String id;
  final String invoiceNo;
  final String issuedAt;
  final String dueAt;
  final String clientName;
  final double total;
  final String status;

  bool get isOverdue {
    if (status != 'unpaid' || dueAt.isEmpty) return false;
    return DateTime.tryParse(dueAt)?.isBefore(DateTime.now()) ?? false;
  }

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] as String? ?? '',
      invoiceNo: json['invoice_no'] as String? ?? '-',
      issuedAt: json['issued_at'] as String? ?? '',
      dueAt: json['due_at'] as String? ?? '',
      clientName: json['client_name'] as String? ?? '(no name)',
      total: (json['total'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'unknown',
    );
  }
}

/// Access to the three accounting collections.
class AccountingRepository {
  AccountingRepository(this._client);

  final HamolusClient _client;

  /// The account list for the accounts table.
  Future<Paged<Account>> listAccounts() {
    return _client.listRecords<Account>(
      'accounts',
      parse: Account.fromJson,
      pageSize: 100,
      sortBy: 'code',
      sortDir: 'asc',
    );
  }

  /// Journal entries, one page at a time.
  ///
  /// `entryNo` and `description` can be filtered. Both are sent as filters rather than
  /// filtered on the device: filtering 20 rows that are already fetched to find one match
  /// is not pagination.
  Future<Paged<JournalEntry>> listJournalEntries({
    int page = 1,
    String? entryNo,
    String? search,
  }) {
    return _client.listRecords<JournalEntry>(
      'journal_entries',
      parse: JournalEntry.fromJson,
      page: page,
      pageSize: 50,
      sortBy: 'entry_date',
      sortDir: 'desc',
      search: search,
      filter: entryNo == null || entryNo.isEmpty
          ? null
          : {'entry_no': FilterClause('eq', entryNo)},
    );
  }

  Future<Paged<Invoice>> listInvoices({int page = 1, String? status}) {
    return _client.listRecords<Invoice>(
      'invoices',
      parse: Invoice.fromJson,
      page: page,
      pageSize: 25,
      sortBy: 'issued_at',
      sortDir: 'desc',
      filter: status == null || status.isEmpty
          ? null
          : {'status': FilterClause('eq', status)},
    );
  }
}
