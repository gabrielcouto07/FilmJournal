import Foundation
import Kit

/// Máquina de estados do jogo "Cine-Detetive".
///
/// Toda a lógica de regras (acerto de ano/gênero/diretor/etc.) roda no backend — a rodada nem
/// guarda estado no servidor, a resposta certa vem embutida e cifrada no `token` devolvido por
/// `startRound`. Este ViewModel só orquestra as chamadas e mantém o estado de UI (pistas
/// reveladas, histórico de palpites, hints obtidos).
@MainActor
final class GameViewModel: ObservableObject {
    enum Phase: Equatable {
        case selectingSource
        case loading
        case playing
        case finished(won: Bool)
    }

    struct GuessHistoryItem: Identifiable, Equatable {
        let id = UUID()
        let card: PlayGuessCard
        let tiles: GuessTiles
        let correct: Bool
    }

    @Published private(set) var phase: Phase = .selectingSource
    @Published var selectedSource: PlaySource = .popular
    @Published var errorMessage: String?

    // Rodada ativa
    @Published private(set) var token: String?
    @Published private(set) var maxGuesses = PlayRules.maxGuesses
    @Published private(set) var castTotal = 0
    @Published private(set) var actors: [PlayActorClue] = []
    @Published private(set) var poster: PlayNextClues.Poster?
    // `PlayNextClues.Hints` (tipo do Kit) não tem init público — guardamos os dois flags
    // separadamente em vez de reconstruir o struct localmente.
    @Published private(set) var keywordsHintAvailable = false
    @Published private(set) var taglineHintAvailable = false
    @Published private(set) var keywordsHint: [String]?
    @Published private(set) var hasFetchedTagline = false
    @Published private(set) var taglineHint: String?
    @Published private(set) var guessHistory: [GuessHistoryItem] = []
    @Published private(set) var answer: PlayAnswer?
    @Published private(set) var isSubmittingGuess = false
    @Published private(set) var isFetchingHint = false

    // Autocomplete de título
    @Published var query = ""
    @Published private(set) var suggestions: [PlaySearchSuggestion] = []

    // Placar
    @Published private(set) var scoresResponse: GameScoresResponse?
    @Published private(set) var lastScoreImproved: Bool?
    @Published private(set) var lastScore: Int?

    private var guessNumber = 1
    private var hintsUsed = 0
    private var excludeIds: [Int] = []

    var bestScoreForSelectedSource: GameScore? { scoresResponse?[selectedSource] }
    var guessesRemaining: Int { max(0, maxGuesses - (guessNumber - 1)) }

    func loadScores(api: FilmJournalAPI) async {
        do {
            scoresResponse = try await api.play.scores()
        } catch {
            // Placar é informativo — falha silenciosa não deve travar a tela inicial.
        }
    }

    func startRound(source: PlaySource, api: FilmJournalAPI) async {
        selectedSource = source
        phase = .loading
        errorMessage = nil
        resetRoundState()
        do {
            let response = try await api.play.startRound(source: source, excludeIds: excludeIds)
            token = response.token
            maxGuesses = response.maxGuesses
            castTotal = response.castTotal
            actors = response.actors
            phase = .playing
        } catch {
            errorMessage = error.localizedDescription
            phase = .selectingSource
        }
    }

    func playAgain(api: FilmJournalAPI) async {
        if let answer {
            excludeIds.append(answer.tmdbId)
        }
        await startRound(source: selectedSource, api: api)
    }

    func searchTitles(api: FilmJournalAPI) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            suggestions = []
            return
        }
        do {
            suggestions = try await api.play.searchTitles(query: trimmed, source: selectedSource)
        } catch is CancellationError {
            // Busca anterior cancelada pelo debounce — não é um erro real.
        } catch {
            suggestions = []
        }
    }

    func submitGuess(_ suggestion: PlaySearchSuggestion, api: FilmJournalAPI) async {
        guard let token, !isSubmittingGuess else { return }
        isSubmittingGuess = true
        defer { isSubmittingGuess = false }
        query = ""
        suggestions = []
        let usedGuessNumber = guessNumber
        do {
            let response = try await api.play.guess(token: token, tmdbId: suggestion.tmdbId, guessNumber: usedGuessNumber)
            guessHistory.append(GuessHistoryItem(card: response.guess, tiles: response.tiles, correct: response.correct))
            guessNumber += 1

            if let next = response.next {
                if let newActor = next.actor, !actors.contains(where: { $0.name == newActor.name }) {
                    actors.append(newActor)
                }
                if let posterClue = next.poster {
                    poster = posterClue
                }
                keywordsHintAvailable = next.hints.keywords
                taglineHintAvailable = next.hints.tagline
            }

            if response.correct || response.gameOver == true {
                answer = response.answer
                await finishRound(won: response.correct, guessesMade: usedGuessNumber, api: api)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func fetchKeywordsHint(api: FilmJournalAPI) async {
        guard let token, keywordsHint == nil, !isFetchingHint else { return }
        isFetchingHint = true
        defer { isFetchingHint = false }
        do {
            keywordsHint = try await api.play.hintKeywords(token: token, guessNumber: guessNumber)
            hintsUsed = min(2, hintsUsed + 1)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func fetchTaglineHint(api: FilmJournalAPI) async {
        guard let token, !hasFetchedTagline, !isFetchingHint else { return }
        isFetchingHint = true
        defer { isFetchingHint = false }
        do {
            taglineHint = try await api.play.hintTagline(token: token, guessNumber: guessNumber)
            hasFetchedTagline = true
            hintsUsed = min(2, hintsUsed + 1)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func giveUp(api: FilmJournalAPI) async {
        guard let token else { return }
        do {
            let result = try await api.play.giveUp(token: token, guessNumber: guessNumber)
            answer = result
            await finishRound(won: false, guessesMade: guessNumber, api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Calcula a pontuação localmente (espelhando `computeHybridScore` do backend) só para
    /// decidir SE vale a pena chamar `submitScore` — uma derrota vale 0 e nunca melhoraria o
    /// recorde salvo, então nem gastamos a chamada de rede nesse caso.
    private func finishRound(won: Bool, guessesMade: Int, api: FilmJournalAPI) async {
        phase = .finished(won: won)
        guard won else {
            lastScore = 0
            lastScoreImproved = false
            await loadScores(api: api)
            return
        }
        let score = max(0, 1000 - (guessesMade - 1) * 100 + (2 - hintsUsed) * 50)
        lastScore = score
        do {
            let result = try await api.play.submitScore(source: selectedSource, score: score, rounds: guessesMade)
            lastScoreImproved = result.improved
        } catch {
            errorMessage = error.localizedDescription
        }
        await loadScores(api: api)
    }

    private func resetRoundState() {
        token = nil
        actors = []
        poster = nil
        keywordsHintAvailable = false
        taglineHintAvailable = false
        keywordsHint = nil
        hasFetchedTagline = false
        taglineHint = nil
        guessHistory = []
        answer = nil
        query = ""
        suggestions = []
        lastScoreImproved = nil
        lastScore = nil
        guessNumber = 1
        hintsUsed = 0
    }
}
