import Foundation
import Kit

/// Busca de filmes no TMDB (`GET /tmdb?q=`) e os 5 feeds (`?feed=`) — resultados já mesclados
/// com `existing` do catálogo local pelo backend. Espelha `web/src/components/MovieSearch.tsx`.
@MainActor
final class SearchViewModel: ObservableObject {
    enum Mode {
        case feed
        case search
    }

    @Published var query = ""
    @Published var selectedFeed: TmdbFeed = .trending
    @Published private(set) var mode: Mode = .feed
    @Published private(set) var results: [TmdbMovieSearchResult] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var mutatingId: Int?
    private(set) var hasSearched = false

    /// Chamado pelo `.task(id:)` da view a cada mudança de `query` (com debounce) ou de aba de
    /// feed — decide se busca ou mostra o feed selecionado.
    func load(api: FilmJournalAPI) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            mode = .feed
            await loadFeed(api: api)
        } else {
            mode = .search
            await search(query: trimmed, api: api)
        }
    }

    private func loadFeed(api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await api.tmdb.feed(selectedFeed)
            results = response.results
        } catch is CancellationError {
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func search(query: String, api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await api.tmdb.search(query: query)
            results = response.results
            hasSearched = true
        } catch is CancellationError {
        } catch {
            errorMessage = error.localizedDescription
            hasSearched = true
        }
    }

    func toggleWatchlist(_ item: TmdbMovieSearchResult, api: FilmJournalAPI) async {
        mutatingId = item.id
        defer { mutatingId = nil }
        do {
            let response = try await api.movies.add(tmdbId: item.id, watchlist: !(item.existing?.watchlist ?? false))
            replace(item: item, withMovie: response.movie)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleFavorite(_ item: TmdbMovieSearchResult, api: FilmJournalAPI) async {
        mutatingId = item.id
        defer { mutatingId = nil }
        do {
            let upsert = try await api.movies.add(tmdbId: item.id)
            let mutation = try await api.movies.mutate(movieId: upsert.movie.id, action: .favorite(!upsert.movie.favorite))
            replace(item: item, withMovie: mutation.movie)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Garante que o filme existe no catálogo local e devolve seu `movieId` local — usado para
    /// abrir a ficha do filme (que já sabe registrar uma sessão) a partir de um card de busca/feed.
    func ensureMovie(_ item: TmdbMovieSearchResult, api: FilmJournalAPI) async -> String? {
        if let existing = item.existing { return existing.id }
        mutatingId = item.id
        defer { mutatingId = nil }
        do {
            let response = try await api.movies.add(tmdbId: item.id)
            replace(item: item, withMovie: response.movie)
            return response.movie.id
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    private func replace(item: TmdbMovieSearchResult, withMovie movie: Movie) {
        let existing = TmdbExistingRef(
            id: movie.id,
            tmdbId: movie.tmdbId,
            updatedAt: movie.updatedAt,
            watchlist: movie.watchlist,
            favorite: movie.favorite,
            favoriteRank: movie.favoriteRank
        )
        guard let index = results.firstIndex(where: { $0.id == item.id }) else { return }
        results[index] = results[index].withExisting(existing)
    }
}
