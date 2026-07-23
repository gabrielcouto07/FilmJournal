import Foundation

/// Regras puras do jogo "Cine-Detetive" — espelha `src/lib/play/hybrid.ts`. Só as constantes
/// e formas de dados; a rodada em si (que embute a resposta) só existe no backend, cifrada.
public enum PlayRules {
    public static let maxGuesses = 10
    public static let castReveals = 5
    public static let hintKeywordsAt = 5
    public static let hintTaglineAt = 8
}

public struct PlayActorClue: Codable, Sendable, Equatable, Identifiable {
    public let name: String
    public let profilePath: String?
    public var id: String { name }
}

/// Resposta de `POST /api/play/round`.
public struct PlayRoundResponse: Decodable, Sendable {
    public let token: String
    public let maxGuesses: Int
    public let castTotal: Int
    public let actors: [PlayActorClue]
    public let source: PlaySource
    public let dayKey: String?
}

public struct StartRoundRequest: Encodable, Sendable {
    public let source: PlaySource
    public var excludeIds: [Int]

    public init(source: PlaySource, excludeIds: [Int] = []) {
        self.source = source
        self.excludeIds = excludeIds
    }
}

public struct PlaySearchSuggestion: Decodable, Sendable, Equatable, Identifiable {
    public let tmdbId: Int
    public let title: String
    public let year: Int?
    public var id: Int { tmdbId }
}

public struct PlaySearchResponse: Decodable, Sendable {
    public let suggestions: [PlaySearchSuggestion]
}

public enum TileGrade: String, Codable, Sendable { case exact, close, miss }
public enum TileDirection: String, Codable, Sendable { case targetHigher = "target-higher", targetLower = "target-lower" }

public struct GuessTiles: Decodable, Sendable, Equatable {
    public struct YearTile: Decodable, Sendable, Equatable {
        public let grade: TileGrade
        public let guessYear: Int?
        public let direction: TileDirection?
    }
    public struct GenresTile: Decodable, Sendable, Equatable {
        public let grade: TileGrade
        public let guessGenres: [String]
        public let shared: [String]
    }
    public struct DirectorTile: Decodable, Sendable, Equatable {
        public let grade: TileGrade
        public let guessDirector: String?
    }
    public struct StudioTile: Decodable, Sendable, Equatable {
        public let grade: TileGrade
        public let guessStudio: String?
        public let shared: [String]
    }
    public struct RatingTile: Decodable, Sendable, Equatable {
        public let grade: TileGrade
        public let guessRating: Double?
        public let direction: TileDirection?
    }
    public struct CastTile: Decodable, Sendable, Equatable {
        public let grade: TileGrade
        public let guessPrincipal: String?
        public let shared: [String]
    }

    public let year: YearTile
    public let genres: GenresTile
    public let director: DirectorTile
    public let studio: StudioTile
    public let rating: RatingTile
    public let cast: CastTile
}

public struct PlayGuessCard: Decodable, Sendable, Equatable {
    public let title: String
    public let year: Int?
    public let posterPath: String?
}

public enum PlayPosterStage: String, Codable, Sendable { case heavy, medium, light }

public struct PlayNextClues: Decodable, Sendable, Equatable {
    public struct Poster: Decodable, Sendable, Equatable {
        public let path: String?
        public let stage: PlayPosterStage
    }
    public struct Hints: Decodable, Sendable, Equatable {
        public let keywords: Bool
        public let tagline: Bool
    }
    public let actor: PlayActorClue?
    public let poster: Poster?
    public let hints: Hints
}

public struct PlayAnswer: Decodable, Sendable, Equatable {
    public let tmdbId: Int
    public let title: String
    public let year: Int?
    public let posterPath: String?
    public let directorName: String?
    public let genres: [String]
    public let cast: [String]
    public let tagline: String?
}

/// Resposta de `POST /api/play/guess` com `action: "guess"` — os campos variam conforme o
/// resultado (acerto, erro com dica liberada, ou fim de jogo); todos exceto `correct`/`tiles`/
/// `guess` são opcionais dependendo do caso.
public struct PlayGuessResponse: Decodable, Sendable {
    public let correct: Bool
    public let tiles: GuessTiles
    public let guess: PlayGuessCard
    public let gameOver: Bool?
    public let next: PlayNextClues?
    public let answer: PlayAnswer?
}

public struct PlayGiveUpResponse: Decodable, Sendable {
    public let answer: PlayAnswer
}

public struct PlayHintKeywordsResponse: Decodable, Sendable {
    public let keywords: [String]
}

public struct PlayHintTaglineResponse: Decodable, Sendable {
    public let tagline: String?
}

struct PlayGuessRequest: Encodable {
    let token: String
    let action: String
    var tmdbId: Int?
    let guessNumber: Int
    var hint: Int?
}
