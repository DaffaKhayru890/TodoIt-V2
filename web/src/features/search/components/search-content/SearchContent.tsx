import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FiClock, FiCornerDownLeft, FiSearch, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button/button';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { Skeleton } from '@/components/ui/skeleton/skeleton';
import { ApiError } from '@/core/errors/api-error';
import { joinClasses } from '@/core/utils/join-classes';
import {
  SEARCH_MIN_QUERY_LENGTH,
  isSearchableQuery,
  type SearchResultItem
} from '../models/search.model';
import { useGlobalSearch } from '../hooks/use-global-search';
import { useRecentSearches } from '../hooks/use-recent-searches';
import { useSearchKeyboard } from '../hooks/use-search-keyboard';
import { HighlightedText } from '../components/highlighted-text/HighlightedText';

export interface SearchContentProps {
  readonly autoFocus?: boolean;
  readonly onClose?: () => void;
}

function getSearchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.';
  }

  return 'Pencarian gagal diproses. Silakan coba lagi.';
}

export function SearchContent({ autoFocus = false, onClose }: SearchContentProps) {
  const navigate = useNavigate();
  const recent = useRecentSearches();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const groupIdPrefix = useId();
  const {
    normalizedQuery,
    debouncedQuery,
    isDebouncing,
    isQueryTooShort,
    workspaces,
    workspacesQuery,
    searchQuery
  } = useGlobalSearch(value);

  const results = searchQuery.data;
  const items = useMemo(
    () => results?.groups.flatMap((group) => group.items) ?? [],
    [results]
  );
  const queryEnabled = isSearchableQuery(debouncedQuery) && workspaces.length > 0;
  const isInitialLoading =
    isSearchableQuery(normalizedQuery) &&
    (isDebouncing || (queryEnabled && searchQuery.isPending));
  const isRefreshing = queryEnabled && searchQuery.isFetching && !searchQuery.isPending;
  const showResults = !isDebouncing && !isQueryTooShort && results !== undefined;
  const showEmpty =
    showResults && !searchQuery.isError && results.total === 0 && !isInitialLoading;
  const showError =
    isSearchableQuery(normalizedQuery) && searchQuery.isError && !isDebouncing;
  const canCommit = isSearchableQuery(normalizedQuery);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [autoFocus]);

  const commitSearch = () => {
    if (canCommit) {
      recent.addSearch(normalizedQuery);
    }
  };

  const openItem = (item: SearchResultItem) => {
    commitSearch();
    onClose?.();
    navigate(item.href);
  };

  const keyboard = useSearchKeyboard({
    itemCount: items.length,
    resetKey: debouncedQuery,
    onSelect: (index) => {
      const item = items[index];

      if (item) {
        openItem(item);
      }
    },
    onSubmit: commitSearch
  });

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    keyboard.handleKeyDown(event);
  };

  const activeItem = keyboard.activeIndex >= 0 ? items[keyboard.activeIndex] : undefined;
  const activeOptionId = activeItem ? `${listboxId}-option-${keyboard.activeIndex}` : undefined;
  const statusMessage = getStatusMessage({
    isDebouncing,
    isQueryTooShort,
    normalizedQuery,
    isLoading: isInitialLoading,
    isError: showError,
    total: results?.total,
    workspaceCount: workspaces.length
  });

  return (
    <div className="search-panel">
      <div className="search-panel__field">
        <label className="search-panel__label" htmlFor={`${listboxId}-input`}>
          Cari tugas, tag, atau label
        </label>
        <div className="search-panel__control">
          <span className="search-panel__glyph" aria-hidden="true">
            <FiSearch />
          </span>
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            className="search-panel__input"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isSearchableQuery(normalizedQuery)}
            aria-controls={isSearchableQuery(normalizedQuery) ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-describedby={`${listboxId}-status`}
            autoComplete="off"
            spellCheck={false}
            placeholder="Cari tugas, tag, atau label…"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          {value.length > 0 ? (
            <button
              type="button"
              className="search-panel__clear"
              aria-label="Hapus kata pencarian"
              onClick={() => {
                setValue('');
                inputRef.current?.focus();
              }}
            >
              <FiX aria-hidden="true" />
            </button>
          ) : null}
          {isInitialLoading || isRefreshing ? (
            <span className="search-panel__spinner" aria-hidden="true" />
          ) : null}
        </div>
        <p id={`${listboxId}-status`} className="visually-hidden" role="status" aria-live="polite">
          {statusMessage}
        </p>
      </div>

      {isQueryTooShort && normalizedQuery.length > 0 ? (
        <p className="search-panel__hint">
          Ketik minimal {SEARCH_MIN_QUERY_LENGTH} karakter untuk mulai mencari.
        </p>
      ) : null}

      {normalizedQuery.length === 0 ? (
        <RecentSearches
          items={recent.items}
          onSelect={(query) => setValue(query)}
          onRemove={recent.removeSearch}
          onClear={recent.clearSearches}
        />
      ) : null}

      {normalizedQuery.length > 0 && workspacesQuery.isLoading ? (
        <SearchLoading />
      ) : null}

      {normalizedQuery.length > 0 && workspacesQuery.isError ? (
        <div className="search-panel__state search-panel__state--error" role="alert">
          <p>Gagal memuat daftar workspace untuk pencarian.</p>
          <Button
            type="button"
            variant="outline"
            size="small"
            onClick={() => {
              void workspacesQuery.refetch();
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : null}

      {normalizedQuery.length > 0 &&
      !workspacesQuery.isLoading &&
      !workspacesQuery.isError &&
      workspaces.length === 0 ? (
        <p className="search-panel__hint">
          Belum ada workspace yang dapat dicari. Buat workspace terlebih dahulu.
        </p>
      ) : null}

      {isInitialLoading && normalizedQuery.length > 0 ? <SearchLoading /> : null}

      {showError ? (
        <div className="search-panel__state search-panel__state--error" role="alert">
          <p>{getSearchErrorMessage(searchQuery.error)}</p>
          <Button
            type="button"
            variant="outline"
            size="small"
            onClick={() => {
              void searchQuery.refetch();
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : null}

      {showEmpty ? (
        <EmptyState
          compact
          title="Tidak ada hasil"
          description={`Tidak ada tugas, tag, atau label yang cocok dengan “${debouncedQuery}”.`}
        />
      ) : null}

      {showResults && results.total > 0 ? (
        <div className="search-results">
          {results.failedWorkspaces > 0 ? (
            <p className="search-results__warning" role="status">
              {results.failedWorkspaces} workspace gagal dicari. Hasil dari workspace lain tetap
              ditampilkan.
            </p>
          ) : null}
          <div
            id={listboxId}
            className="search-results__list"
            role="listbox"
            aria-label="Hasil pencarian"
          >
            {results.groups.map((group, groupIndex) => {
              const headingId = `${groupIdPrefix}-group-${groupIndex}`;

              return (
                <div
                  className="search-results__group"
                  role="group"
                  aria-labelledby={headingId}
                  key={group.kind}
                >
                  <p id={headingId} className="search-results__group-title">
                    {group.label}
                    <span className="search-results__group-count">{group.items.length}</span>
                  </p>
                  <ul className="search-results__items" role="presentation">
                    {group.items.map((item) => {
                      const index = items.findIndex(
                        (candidate) =>
                          candidate.kind === item.kind &&
                          candidate.id === item.id &&
                          candidate.workspaceId === item.workspaceId
                      );
                      const selected = index === keyboard.activeIndex;

                      return (
                        <li key={`${item.kind}:${item.workspaceId}:${item.id}`} role="presentation">
                          <button
                            id={`${listboxId}-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            tabIndex={-1}
                            className={joinClasses(
                              'search-results__item',
                              selected && 'search-results__item--active'
                            )}
                            onMouseEnter={() => keyboard.setActiveIndex(index)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              openItem(item);
                            }}
                          >
                            <span className="search-results__item-main">
                              <span className="search-results__item-title">
                                <HighlightedText text={item.title} query={debouncedQuery} />
                              </span>
                              {item.description ? (
                                <span className="search-results__item-description">
                                  <HighlightedText
                                    text={item.description}
                                    query={debouncedQuery}
                                  />
                                </span>
                              ) : null}
                              <span className="search-results__item-meta">
                                {item.meta} · {item.workspaceName}
                              </span>
                            </span>
                            {selected ? (
                              <span className="search-results__enter" aria-hidden="true">
                                <FiCornerDownLeft />
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="search-results__footer">
            <span>↑ ↓ navigasi</span>
            <span>Enter buka</span>
            <span>Esc tutup</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SearchLoading() {
  return (
    <div className="search-panel__loading" aria-busy="true" aria-label="Mencari">
      {[0, 1, 2].map((index) => (
        <div className="search-panel__loading-row" key={index}>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>
      ))}
    </div>
  );
}

function RecentSearches({
  items,
  onSelect,
  onRemove,
  onClear
}: {
  items: readonly string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="recent-searches" aria-labelledby="recent-searches-title">
      <div className="recent-searches__header">
        <h3 id="recent-searches-title" className="recent-searches__title">
          Pencarian terakhir
        </h3>
        {items.length > 0 ? (
          <button type="button" className="recent-searches__clear" onClick={onClear}>
            Hapus semua
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="recent-searches__empty">
          Belum ada pencarian terakhir. Riwayat disimpan hanya di perangkat ini.
        </p>
      ) : (
        <ul className="recent-searches__list">
          {items.map((query) => (
            <li className="recent-searches__item" key={query}>
              <button
                type="button"
                className="recent-searches__select"
                onClick={() => onSelect(query)}
              >
                <FiClock aria-hidden="true" />
                <span>{query}</span>
              </button>
              <button
                type="button"
                className="recent-searches__remove"
                aria-label={`Hapus pencarian ${query}`}
                onClick={() => onRemove(query)}
              >
                <FiX aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getStatusMessage(input: {
  isDebouncing: boolean;
  isQueryTooShort: boolean;
  normalizedQuery: string;
  isLoading: boolean;
  isError: boolean;
  total: number | undefined;
  workspaceCount: number;
}): string {
  if (input.normalizedQuery.length === 0) {
    return 'Ketik untuk mencari.';
  }

  if (input.isQueryTooShort) {
    return `Ketik minimal ${SEARCH_MIN_QUERY_LENGTH} karakter.`;
  }

  if (input.isDebouncing || input.isLoading) {
    return 'Mencari…';
  }

  if (input.isError) {
    return 'Pencarian gagal.';
  }

  if (input.workspaceCount === 0) {
    return 'Tidak ada workspace yang dapat dicari.';
  }

  if (input.total === 0) {
    return 'Tidak ada hasil.';
  }

  return `${input.total ?? 0} hasil ditemukan.`;
}
