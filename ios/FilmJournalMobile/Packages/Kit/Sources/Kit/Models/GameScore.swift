import Foundation

public enum PlaySource: String, Codable, Sendable, CaseIterable {
    case mine
    case popular
    case daily
}

public struct GameScore: Decodable, Sendable, Equatable {
    public let bestScore: Int
    public let bestRounds: Int
}

/// Resposta de `GET /api/play/score` — uma entrada por fonte, ausente se nunca jogada.
public struct GameScoresResponse: Decodable, Sendable {
    public let scores: [String: GameScore]

    public subscript(source: PlaySource) -> GameScore? { scores[source.rawValue] }
}

public struct SubmitScoreRequest: Encodable, Sendable {
    public let source: PlaySource
    public let score: Int
    public let rounds: Int

    public init(source: PlaySource, score: Int, rounds: Int) {
        self.source = source
        self.score = score
        self.rounds = rounds
    }
}

public struct SubmitScoreResponse: Decodable, Sendable {
    public let improved: Bool
    public let bestScore: Int
}
