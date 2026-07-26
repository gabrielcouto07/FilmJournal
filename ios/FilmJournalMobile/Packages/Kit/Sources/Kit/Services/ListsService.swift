import Foundation

/// `/lists` — coleções nomeadas e livres do usuário (distintas de Favoritos/Top10/Watchlist).
public final class ListsService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// `movieId`, quando informado, preenche `MovieList.containsMovie` para cada lista — é o
    /// que alimenta o botão "Adicionar à lista" na ficha do filme.
    public func all(movieId: String? = nil) async throws -> [MovieList] {
        let response: ListsResponse = try await client.request(.get, "/lists", query: ["movieId": movieId])
        return response.lists
    }

    public func detail(id: String) async throws -> MovieListDetail {
        let response: ListDetailResponse = try await client.request(.get, "/lists/\(id)")
        return response.list
    }

    @discardableResult
    public func create(_ request: CreateListRequest) async throws -> MovieList {
        let response: ListMutationResponse = try await client.request(.post, "/lists", body: request)
        return response.list
    }

    @discardableResult
    public func update(id: String, _ request: UpdateListRequest) async throws -> MovieList {
        let response: ListMutationResponse = try await client.request(.patch, "/lists/\(id)", body: request)
        return response.list
    }

    public func delete(id: String) async throws {
        try await client.requestDiscardingResponse(.delete, "/lists/\(id)")
    }

    /// Devolve `true` se o filme já estava na lista (idempotente, não é erro — ver rota original).
    @discardableResult
    public func addMovie(listId: String, movieId: String) async throws -> Bool {
        let response: ListMovieMutationResponse = try await client.request(
            .post, "/lists/\(listId)/movies", body: AddMovieToListRequest(movieId: movieId)
        )
        return response.alreadyAdded
    }

    public func removeMovie(listId: String, movieId: String) async throws {
        try await client.requestDiscardingResponse(.delete, "/lists/\(listId)/movies", query: ["movieId": movieId])
    }
}
