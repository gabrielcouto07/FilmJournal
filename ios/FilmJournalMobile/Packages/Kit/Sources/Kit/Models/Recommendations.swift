import Foundation

/// Espelha os tipos de `src/lib/recommendations.ts` — a home "Paladar" e a tela Descobrir.
public struct ExistingRecommendationMovie: Decodable, Sendable, Equatable {
    public let id: String
    public let watchlist: Bool
    public let favorite: Bool
}

public struct TasteRecommendation: Decodable, Sendable, Equatable, Identifiable {
    public let tmdbId: Int
    public let title: String
    public let year: Int?
    public let posterPath: String?
    public let preferredPosterPath: String?
    public let overview: String?
    public let tmdbRating: Double?
    public let reason: String
    public let existing: ExistingRecommendationMovie?

    public var id: Int { tmdbId }
    public var effectivePosterPath: String? { preferredPosterPath ?? posterPath }
}

public struct TasteDirector: Decodable, Sendable, Equatable, Identifiable {
    public let name: String
    public let watchedCount: Int
    public let averageRating: Double?
    public let favoriteCount: Int
    public let reason: String
    public let films: [TasteRecommendation]

    public var id: String { name }
}

public struct TasteBlindSpot: Decodable, Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let year: Int?
    public let rating: Double
    public let posterPath: String?
    public let preferredPosterPath: String?

    public var effectivePosterPath: String? { preferredPosterPath ?? posterPath }
}

public struct TasteGenreStat: Decodable, Sendable, Equatable {
    public let name: String
    public let count: Int
    public let averageRating: Double?
}

public struct TasteProfile: Decodable, Sendable, Equatable {
    public let watchedFilms: Int
    public let ratedFilms: Int
    public let reviewedFilms: Int
    public let favoriteDecade: String?
    public let topGenres: [TasteGenreStat]
}

/// Resposta de `GET /api/recommendations`.
public struct TasteData: Decodable, Sendable {
    public let generatedAt: String
    public let cacheTtlHours: Int
    public let profile: TasteProfile
    public let becauseYouLoved: [TasteRecommendation]
    public let directors: [TasteDirector]
    public let genreDiscovery: [TasteRecommendation]
    public let genreDiscoveryLabel: String
    public let blindSpots: [TasteBlindSpot]
}
