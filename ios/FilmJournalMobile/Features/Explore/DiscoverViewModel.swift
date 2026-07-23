import Foundation
import Kit

/// Pontos cegos do acervo (`GET /api/discover`, `POST /api/discover/dismiss`).
@MainActor
final class DiscoverViewModel: ObservableObject {
    @Published var dimension: GapDimension?
    @Published private(set) var picks: [BlindSpotPick] = []
    @Published private(set) var totalFilms = 0
    @Published private(set) var degraded = false
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var dismissingGapKeys: Set<String> = []
    private(set) var hasLoaded = false

    init(initialDimension: GapDimension?) {
        self.dimension = initialDimension
    }

    func load(api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let data = try await api.discover.picks(dimension: dimension)
            picks = data.picks
            totalFilms = data.totalFilms
            degraded = data.degraded
            hasLoaded = true
        } catch {
            errorMessage = error.localizedDescription
            hasLoaded = true
        }
    }

    func dismiss(_ pick: BlindSpotPick, api: FilmJournalAPI) async {
        dismissingGapKeys.insert(pick.gapKey)
        defer { dismissingGapKeys.remove(pick.gapKey) }
        do {
            try await api.discover.dismiss(dimension: pick.dimension, gapKey: pick.gapKey)
            picks.removeAll { $0.gapKey == pick.gapKey && $0.dimension == pick.dimension }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
