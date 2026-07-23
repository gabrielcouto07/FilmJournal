import Foundation
import Kit

/// Busca de filmes no TMDB (`GET /api/tmdb?q=`) — resultados já mesclados com `existing` do
/// catálogo local pelo backend.
@MainActor
final class SearchViewModel: ObservableObject {
    @Published var query = ""
    @Published private(set) var results: [TmdbMovieSearchResult] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    /// `true` assim que uma busca terminou (mesmo sem resultados) — distingue "ainda não
    /// buscou" (estado inicial) de "buscou e não achou nada".
    private(set) var hasSearched = false

    func search(api: FilmJournalAPI) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            hasSearched = false
            errorMessage = nil
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.tmdb.search(query: trimmed)
            results = response.results
            hasSearched = true
        } catch is CancellationError {
            // Busca anterior cancelada pelo debounce — não é um erro real.
        } catch {
            errorMessage = error.localizedDescription
            hasSearched = true
        }
    }
}
