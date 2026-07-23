import Foundation

/// `/api/roulette/*` — sorteio de filmes com filtros persistidos.
public final class RouletteService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// Monta o pool sorteável. `watchlist`/`blindspots` exigem usuário autenticado.
    public func pool(
        source: RouletteSource = .popular,
        genres: [Int] = [],
        people: [Int] = [],
        yearFrom: String? = nil,
        yearTo: String? = nil,
        runtimeMax: Int? = nil,
        count: Int = 8
    ) async throws -> RoulettePoolResponse {
        let genresParam: String? = genres.isEmpty ? nil : genres.map(String.init).joined(separator: ",")
        let peopleParam: String? = people.isEmpty ? nil : people.map(String.init).joined(separator: ",")
        let runtimeParam: String? = runtimeMax.map(String.init)
        let query: [String: String?] = [
            "source": source.rawValue,
            "genres": genresParam,
            "people": peopleParam,
            "yearFrom": yearFrom,
            "yearTo": yearTo,
            "runtimeMax": runtimeParam,
            "count": String(count),
        ]
        return try await client.request(.get, "/api/roulette/discover", query: query)
    }

    public func detail(movieId: Int) async throws -> RouletteMovieDetail.Detail {
        let response: RouletteMovieDetail = try await client.request(.get, "/api/roulette/discover", query: ["movieId": String(movieId)])
        return response.movie
    }

    public func genres() async throws -> [RouletteGenre] {
        let response: RouletteGenresResponse = try await client.request(.get, "/api/roulette/genres")
        return response.genres
    }

    public func people(query: String) async throws -> [RoulettePeopleResponse.Person] {
        let response: RoulettePeopleResponse = try await client.request(.get, "/api/roulette/people", query: ["q": query])
        return response.people
    }

    public func prefs() async throws -> RoulettePrefs? {
        let response: RoulettePrefsResponse = try await client.request(.get, "/api/roulette/prefs")
        return response.prefs
    }

    public func savePrefs(_ prefs: RoulettePrefs) async throws {
        try await client.requestDiscardingResponse(.put, "/api/roulette/prefs", body: prefs)
    }
}
