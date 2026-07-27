import Foundation

/// As dimensões usadas para achar "pontos cegos" no acervo.
public enum GapDimension: String, Codable, Sendable, CaseIterable {
    case decade
    case country
    case language
    case genre
}

public struct CandidateMovie: Decodable, Sendable, Equatable {
    public let tmdbId: Int
    public let title: String
    public let year: Int?
    public let posterPath: String?
    public let backdropPath: String?
    public let overview: String?
    public let rating: Double?
    public let voteCount: Int?
    public let genreIds: [Int]
}

public struct BlindSpotPick: Decodable, Sendable, Equatable, Identifiable {
    public let movie: CandidateMovie
    public let dimension: GapDimension
    public let gapKey: String
    public let gapLabel: String
    public let coverage: Int
    public let rationale: String

    public var id: String { "\(dimension.rawValue)-\(gapKey)-\(movie.tmdbId)" }
}

public struct DiscoverData: Decodable, Sendable {
    public let totalFilms: Int
    public let focus: String // "decade" | "country" | "language" | "genre" | "auto"
    public let picks: [BlindSpotPick]
    public let degraded: Bool
}

public struct DismissBlindSpotRequest: Encodable, Sendable {
    public let dimension: GapDimension
    /// `"*"` dispensa a dimensão inteira.
    public let gapKey: String

    public init(dimension: GapDimension, gapKey: String) {
        self.dimension = dimension
        self.gapKey = gapKey
    }
}
