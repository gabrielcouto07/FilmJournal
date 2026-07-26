import Foundation
import Kit

@MainActor
final class ListDetailViewModel: ObservableObject {
    @Published private(set) var list: MovieListDetail?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var removingMovieId: String?

    func load(id: String, api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            list = try await api.lists.detail(id: id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeMovie(_ item: MovieListDetailItem, api: FilmJournalAPI) async {
        guard let list else { return }
        removingMovieId = item.movieId
        defer { removingMovieId = nil }
        do {
            try await api.lists.removeMovie(listId: list.id, movieId: item.movieId)
            self.list = MovieListDetail(
                id: list.id,
                name: list.name,
                description: list.description,
                isPublic: list.isPublic,
                createdAt: list.createdAt,
                updatedAt: list.updatedAt,
                movies: list.movies.filter { $0.movieId != item.movieId }
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
