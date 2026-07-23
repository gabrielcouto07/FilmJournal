import Foundation
import Kit

/// Estado da escolha de até 5 filmes favoritos com nota (`POST /api/onboarding`).
@MainActor
final class OnboardingViewModel: ObservableObject {
    struct SelectedFilm: Identifiable {
        let tmdbId: Int
        let title: String
        let posterPath: String?
        var rating: Double

        var id: Int { tmdbId }
    }

    @Published var query = ""
    @Published private(set) var results: [TmdbMovieSearchResult] = []
    @Published private(set) var selectedFilms: [SelectedFilm] = []
    @Published private(set) var isSearching = false
    @Published private(set) var isSubmitting = false
    @Published var errorMessage: String?

    var canAddMore: Bool { selectedFilms.count < 5 }

    func isSelected(_ tmdbId: Int) -> Bool {
        selectedFilms.contains { $0.tmdbId == tmdbId }
    }

    func search(api: FilmJournalAPI) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            return
        }
        isSearching = true
        defer { isSearching = false }
        do {
            let response = try await api.tmdb.search(query: trimmed)
            results = response.results
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggle(_ result: TmdbMovieSearchResult) {
        if isSelected(result.id) {
            remove(tmdbId: result.id)
        } else if canAddMore {
            selectedFilms.append(SelectedFilm(tmdbId: result.id, title: result.title, posterPath: result.posterPath, rating: 3.0))
        }
    }

    func remove(tmdbId: Int) {
        selectedFilms.removeAll { $0.tmdbId == tmdbId }
    }

    func updateRating(tmdbId: Int, rating: Double) {
        guard let index = selectedFilms.firstIndex(where: { $0.tmdbId == tmdbId }) else { return }
        selectedFilms[index].rating = rating
    }

    /// Retorna `true` em caso de sucesso (para o caller decidir a navegação).
    func submit(api: FilmJournalAPI) async -> Bool {
        guard !selectedFilms.isEmpty else { return false }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let seeds = selectedFilms.map { OnboardingSeed(tmdbId: $0.tmdbId, rating: $0.rating) }
            _ = try await api.onboarding.submit(seeds: seeds)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
