import Foundation
import Kit
import CoordinatorKit

/// Limitação real da API (`GET /api/movies`): só existe filtro server-side para `watchlist`
/// (`watchlistOnly: true`, já ordenado por data de adição). Não há filtro server-side para
/// "só favoritos" ou "só Top 10" — por isso essas duas abas buscam o catálogo inteiro (paginado
/// em até 200 itens) e filtram no cliente. Não é um bug, é como a API foi desenhada hoje.
@MainActor
final class CollectionViewModel: ObservableObject {
    @Published private(set) var movies: [Movie] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var mutatingMovieId: String?

    func load(tab: CollectionTab, api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            switch tab {
            case .watchlist:
                movies = try await api.movies.list(watchlistOnly: true, limit: 100)
            case .favorites:
                let all = try await api.movies.list(limit: 200)
                movies = all.filter(\.favorite)
            case .top10:
                let all = try await api.movies.list(limit: 200)
                movies = all
                    .filter { $0.favoriteRank != nil }
                    .sorted { ($0.favoriteRank ?? Int.max) < ($1.favoriteRank ?? Int.max) }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Remove o filme da aba atual (otimista) — atualiza o item com o `Movie` retornado quando
    /// possível, ou simplesmente o retira da lista local.
    func remove(_ movie: Movie, from tab: CollectionTab, api: FilmJournalAPI) async {
        mutatingMovieId = movie.id
        defer { mutatingMovieId = nil }
        let action: MovieCollectionAction
        switch tab {
        case .watchlist: action = .watchlist(false)
        case .favorites: action = .favorite(false)
        case .top10: action = .top10(false)
        }
        do {
            _ = try await api.movies.mutate(movieId: movie.id, action: action)
            movies.removeAll { $0.id == movie.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
