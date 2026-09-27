// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/// Journal report: a list of journal lines with page navigation.
///
/// The pattern used across this example app: loading happens in [initState], the result
/// is kept in State, and every page change calls the repository again. That is enough for
/// a single screen. A real app with many screens would centralise it in Provider or
/// Riverpod — and the repository layer here would not change at all because of that move.
library;

import 'package:flutter/material.dart';

import 'accounting_repository.dart';
import 'hamolus_client.dart';

class JournalPage extends StatefulWidget {
  const JournalPage({super.key, required this.repository});

  final AccountingRepository repository;

  @override
  State<JournalPage> createState() => _JournalPageState();
}

class _JournalPageState extends State<JournalPage> {
  int _page = 1;
  Paged<JournalEntry>? _result;
  HamolusApiException? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await widget.repository.listJournalEntries(page: _page);
      // The widget may already be gone when the request returns; calling setState there
      // throws. `mounted` is checked because it costs one line, while the exception is
      // hard to trace down.
      if (!mounted) return;
      setState(() => _result = result);
    } on HamolusApiException catch (cause) {
      if (!mounted) return;
      setState(() => _error = cause);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _goTo(int page) {
    setState(() => _page = page);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    final error = _error;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Journal'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
            tooltip: 'Reload',
          ),
        ],
      ),
      body: Column(
        children: [
          if (_loading) const LinearProgressIndicator(),
          Expanded(child: _buildBody(result, error)),
          if (result != null) _buildPagination(result),
        ],
      ),
    );
  }

  Widget _buildBody(Paged<JournalEntry>? result, HamolusApiException? error) {
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 40),
              const SizedBox(height: 12),
              Text(
                error.isNetwork
                    ? 'Cannot reach the core. Check its address.'
                    : error.message,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text('${error.code} (HTTP ${error.status})',
                  style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: const Text('Try again')),
            ],
          ),
        ),
      );
    }

    final rows = result?.items ?? const <JournalEntry>[];
    if (rows.isEmpty && !_loading) {
      return const Center(child: Text('No journal entries yet.'));
    }

    return ListView.builder(
      itemCount: rows.length,
      itemBuilder: (context, index) {
        final entry = rows[index];
        return ListTile(
          title: Text(entry.description.isEmpty ? entry.entryNo : entry.description),
          subtitle: Text('${entry.entryNo} · ${entry.entryDate}'),
          trailing: Text(
            entry.isDebit
                ? 'D ${_format(entry.debit, entry.currency)}'
                : 'C ${_format(entry.credit, entry.currency)}',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: entry.isDebit ? Colors.teal : Colors.orange,
            ),
          ),
        );
      },
    );
  }

  Widget _buildPagination(Paged<JournalEntry> result) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          TextButton(
            // Pagination follows `meta` rather than a guess from the list length: a last
            // page holding one row looks like a full page when counted by list length.
            onPressed: result.meta.page > 1 ? () => _goTo(result.meta.page - 1) : null,
            child: const Text('Previous'),
          ),
          Text('${result.meta.page} / ${result.meta.totalPages}'),
          TextButton(
            onPressed: result.hasNextPage ? () => _goTo(result.meta.page + 1) : null,
            child: const Text('Next'),
          ),
        ],
      ),
    );
  }

  static String _format(double value, String currency) {
    // Accounting figures carry no thousands separator in some reports; this is a
    // presentation choice, not a rule from the core.
    return '${value.toStringAsFixed(2)} $currency';
  }
}
