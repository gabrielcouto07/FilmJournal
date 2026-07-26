import Foundation
import Kit

/// Carrega e mantém o "Paladar" — recomendações (`GET /recommendations`) e a análise de gosto
/// (`/palate`, `/stats`, `/timeline`, `/motifs`), todos computados no servidor.
@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var taste: TasteData?
    @Published private(set) var charts: ChartsData?
    @Published private(set) var verdict: Verdict?
    @Published private(set) var directors: [DirectorLoyalty] = []
    @Published private(set) var motifs: MotifSummary?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    /// `refresh: true` ignora o cache de 6h do backend (usado no pull-to-refresh).
    func load(refresh: Bool = false, api: FilmJournalAPI) async {
        if taste == nil { isLoading = true }
        defer { isLoading = false }
        errorMessage = nil
        do {
            async let tasteResult = api.recommendations.taste(refresh: refresh)
            async let palateResult = api.dashboard.palate()
            async let statsResult = api.dashboard.stats()
            async let timelineResult = api.dashboard.timeline()
            async let motifsResult = api.dashboard.motifs()

            taste = try await tasteResult
            let palate = try await palateResult
            let stats = try await statsResult
            let timeline = try await timelineResult
            motifs = try await motifsResult

            charts = ChartsAnalytics.compute(palate: palate, stats: stats, timeline: timeline)
            verdict = palate.verdict
            directors = palate.directors
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
