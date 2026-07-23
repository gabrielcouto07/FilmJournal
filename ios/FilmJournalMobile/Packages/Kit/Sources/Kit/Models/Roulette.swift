import Foundation

public enum RouletteSource: String, Codable, Sendable, CaseIterable {
    case popular
    case watchlist
    case blindspots
}

public struct RoulettePerson: Codable, Sendable, Equatable, Identifiable {
    public let id: Int
    public let name: String
}

/// Preferências persistidas em `UserSettings.rouletteFilters` (JSON livre no schema, mas com
/// forma fixa validada pelo zod em `src/app/api/roulette/prefs/route.ts`).
public struct RoulettePrefs: Codable, Sendable, Equatable {
    public var source: RouletteSource
    public var genres: [Int]
    public var people: [RoulettePerson]
    public var yearFrom: String
    public var yearTo: String
    public var runtimeMax: Int
    public var count: Int

    public init(
        source: RouletteSource = .popular,
        genres: [Int] = [],
        people: [RoulettePerson] = [],
        yearFrom: String = "",
        yearTo: String = "",
        runtimeMax: Int = 240,
        count: Int = 8
    ) {
        self.source = source
        self.genres = genres
        self.people = people
        self.yearFrom = yearFrom
        self.yearTo = yearTo
        self.runtimeMax = runtimeMax
        self.count = count
    }
}

public struct RoulettePrefsResponse: Decodable, Sendable {
    public let prefs: RoulettePrefs?
}

/// Um filme no "pool" sorteável (`GET /api/roulette/discover` sem `movieId`).
public struct RoulettePoolMovie: Decodable, Sendable, Equatable, Identifiable {
    public let id: Int
    public let title: String
    public let year: Int?
    public let posterPath: String?
    public let backdropPath: String?
    public let rating: Double?
    public let overview: String?
    public let genreIds: [Int]
    public let rationale: String?
    public let gapLabel: String?
}

public struct RoulettePoolResponse: Decodable, Sendable {
    public let movies: [RoulettePoolMovie]
    public let totalResults: Int
}

/// Detalhe localizado do filme sorteado (`GET /api/roulette/discover?movieId=`).
public struct RouletteMovieDetail: Decodable, Sendable, Equatable {
    public struct Detail: Decodable, Sendable, Equatable {
        public let id: Int
        public let title: String
        public let year: Int?
        public let runtime: Int?
        public let genres: [String]
        public let overview: String?
        public let backdropPath: String?
        public let posterPath: String?
        public let rating: Double?
    }
    public let movie: Detail
}

public struct RouletteGenre: Decodable, Sendable, Equatable, Identifiable {
    public let id: Int
    public let name: String
}

public struct RouletteGenresResponse: Decodable, Sendable {
    public let genres: [RouletteGenre]
}

public struct RoulettePeopleResponse: Decodable, Sendable {
    public struct Person: Decodable, Sendable, Equatable, Identifiable {
        public let id: Int
        public let name: String
        public let department: String?
        public let knownFor: [String]
    }
    public let people: [Person]
}
