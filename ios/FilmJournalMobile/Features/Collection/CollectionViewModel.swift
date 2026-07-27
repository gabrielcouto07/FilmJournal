import Foundation
import Kit
import CoordinatorKit

// A API só filtra `watchlist` no servidor; favoritos e Top 10 puxam o catálogo e filtram no cliente.
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
            case .lists:
                // Listas custom carregam pelo `ListsHubViewModel`.
                break
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func remove(_ movie: Movie, from tab: CollectionTab, api: FilmJournalAPI) async {
        mutatingMovieId = movie.id
        defer { mutatingMovieId = nil }
        let action: MovieCollectionAction
        switch tab {
        case .watchlist: action = .watchlist(false)
        case .favorites: action = .favorite(false)
        case .top10: action = .top10(false)
        case .lists: return
        }
        do {
            _ = try await api.movies.mutate(movieId: movie.id, action: action)
            movies.removeAll { $0.id == movie.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // O backend troca de posição com o vizinho, então dois itens mudam: recarrega a aba inteira.
    func moveRank(_ movie: Movie, direction: Int, api: FilmJournalAPI) async {
        guard let rank = movie.favoriteRank else { return }
        let newRank = rank + direction
        guard (1...10).contains(newRank) else { return }
        mutatingMovieId = movie.id
        defer { mutatingMovieId = nil }
        do {
            _ = try await api.movies.mutate(movieId: movie.id, action: .favoriteRank(newRank))
            await load(tab: .top10, api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
