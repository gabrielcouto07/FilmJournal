import Foundation

/// `/api/play/*` — o jogo "Cine-Detetive" (estilo Wordle) e seu placar.
///
/// A rodada não guarda estado no servidor: a resposta certa vem embutida, cifrada, no `token`
/// devolvido por `startRound`. Cada chamada de `guess`/`hint`/`giveUp` reenvia esse mesmo token.
public final class PlayService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func startRound(source: PlaySource, excludeIds: [Int] = []) async throws -> PlayRoundResponse {
        try await client.request(.post, "/api/play/round", body: StartRoundRequest(source: source, excludeIds: excludeIds))
    }

    public func searchTitles(query: String, source: PlaySource) async throws -> [PlaySearchSuggestion] {
        let response: PlaySearchResponse = try await client.request(.get, "/api/play/search", query: [
            "q": query,
            "source": source.rawValue,
        ])
        return response.suggestions
    }

    public func guess(token: String, tmdbId: Int, guessNumber: Int) async throws -> PlayGuessResponse {
        try await client.request(.post, "/api/play/guess", body: PlayGuessRequest(token: token, action: "guess", tmdbId: tmdbId, guessNumber: guessNumber, hint: nil))
    }

    public func hintKeywords(token: String, guessNumber: Int) async throws -> [String] {
        let response: PlayHintKeywordsResponse = try await client.request(.post, "/api/play/guess", body: PlayGuessRequest(token: token, action: "hint", tmdbId: nil, guessNumber: guessNumber, hint: 1))
        return response.keywords
    }

    public func hintTagline(token: String, guessNumber: Int) async throws -> String? {
        let response: PlayHintTaglineResponse = try await client.request(.post, "/api/play/guess", body: PlayGuessRequest(token: token, action: "hint", tmdbId: nil, guessNumber: guessNumber, hint: 2))
        return response.tagline
    }

    public func giveUp(token: String, guessNumber: Int) async throws -> PlayAnswer {
        let response: PlayGiveUpResponse = try await client.request(.post, "/api/play/guess", body: PlayGuessRequest(token: token, action: "giveup", tmdbId: nil, guessNumber: guessNumber, hint: nil))
        return response.answer
    }

    public func scores() async throws -> GameScoresResponse {
        try await client.request(.get, "/api/play/score")
    }

    public func submitScore(source: PlaySource, score: Int, rounds: Int) async throws -> SubmitScoreResponse {
        try await client.request(.post, "/api/play/score", body: SubmitScoreRequest(source: source, score: score, rounds: rounds))
    }
}
