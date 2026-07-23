import Foundation
import Kit

/// Sorteio de filme com filtros persistidos. Diferente do jogo, a Roleta não guarda um "estado
/// de rodada" no servidor: cada "girada" busca um pool inteiro (`pool.movies`) e a experiência de
/// "sortear outro" apenas avança localmente pela lista já carregada, sem nova chamada de rede.
@MainActor
final class RouletteViewModel: ObservableObject {
    @Published var source: RouletteSource = .popular
    @Published var selectedGenreIds: Set<Int> = []
    @Published var selectedPeople: [RoulettePerson] = []
    @Published var yearFrom = ""
    @Published var yearTo = ""
    @Published var runtimeMax: Double = 240
    @Published var count = 8

    @Published private(set) var availableGenres: [RouletteGenre] = []
    @Published var peopleQuery = ""
    @Published private(set) var peopleSuggestions: [RoulettePeopleResponse.Person] = []

    @Published private(set) var isLoadingFilters = false
    @Published private(set) var isSpinning = false
    @Published private(set) var isSavingPrefs = false
    @Published var errorMessage: String?
    @Published private(set) var didSavePrefs = false

    @Published private(set) var pool: [RoulettePoolMovie] = []
    @Published private(set) var currentIndex = 0
    @Published private(set) var totalResults = 0

    var currentMovie: RoulettePoolMovie? {
        pool.indices.contains(currentIndex) ? pool[currentIndex] : nil
    }

    var hasMoreInPool: Bool { currentIndex < pool.count - 1 }
    var requiresLogin: Bool { source != .popular }

    func loadFilters(api: FilmJournalAPI) async {
        isLoadingFilters = true
        errorMessage = nil
        defer { isLoadingFilters = false }
        do {
            async let genresTask = api.roulette.genres()
            async let prefsTask = api.roulette.prefs()
            let (genres, prefs) = try await (genresTask, prefsTask)
            availableGenres = genres
            if let prefs {
                apply(prefs)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func apply(_ prefs: RoulettePrefs) {
        source = prefs.source
        selectedGenreIds = Set(prefs.genres)
        selectedPeople = prefs.people
        yearFrom = prefs.yearFrom
        yearTo = prefs.yearTo
        runtimeMax = Double(prefs.runtimeMax)
        count = prefs.count
    }

    func searchPeople(api: FilmJournalAPI) async {
        let trimmed = peopleQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            peopleSuggestions = []
            return
        }
        do {
            peopleSuggestions = try await api.roulette.people(query: trimmed)
        } catch is CancellationError {
            // Busca anterior cancelada pelo debounce.
        } catch {
            peopleSuggestions = []
        }
    }

    func addPerson(_ person: RoulettePeopleResponse.Person) {
        guard !selectedPeople.contains(where: { $0.id == person.id }) else { return }
        if let roulettePerson = Self.decodeRoulettePerson(id: person.id, name: person.name) {
            selectedPeople.append(roulettePerson)
        }
        peopleQuery = ""
        peopleSuggestions = []
    }

    /// `RoulettePerson` (tipo do Kit) só expõe `init(from: Decoder)` fora do módulo — não há
    /// inicializador memberwise público. Contornamos isso decodificando um JSON equivalente em
    /// vez de tentar chamar um `init` que não existe publicamente.
    private static func decodeRoulettePerson(id: Int, name: String) -> RoulettePerson? {
        guard let data = try? JSONSerialization.data(withJSONObject: ["id": id, "name": name]) else { return nil }
        return try? JSONDecoder().decode(RoulettePerson.self, from: data)
    }

    func removePerson(_ person: RoulettePerson) {
        selectedPeople.removeAll { $0.id == person.id }
    }

    private var currentPrefs: RoulettePrefs {
        RoulettePrefs(
            source: source,
            genres: Array(selectedGenreIds),
            people: selectedPeople,
            yearFrom: yearFrom,
            yearTo: yearTo,
            runtimeMax: Int(runtimeMax),
            count: count
        )
    }

    func savePrefs(api: FilmJournalAPI) async {
        isSavingPrefs = true
        didSavePrefs = false
        defer { isSavingPrefs = false }
        do {
            try await api.roulette.savePrefs(currentPrefs)
            didSavePrefs = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func spin(api: FilmJournalAPI) async {
        isSpinning = true
        errorMessage = nil
        defer { isSpinning = false }
        do {
            let response = try await api.roulette.pool(
                source: source,
                genres: Array(selectedGenreIds),
                people: selectedPeople.map(\.id),
                yearFrom: yearFrom.isEmpty ? nil : yearFrom,
                yearTo: yearTo.isEmpty ? nil : yearTo,
                runtimeMax: Int(runtimeMax),
                count: count
            )
            pool = response.movies
            totalResults = response.totalResults
            currentIndex = 0
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func nextMovie() {
        guard hasMoreInPool else { return }
        currentIndex += 1
    }

    func genreName(for id: Int) -> String? {
        availableGenres.first { $0.id == id }?.name
    }
}
