import Foundation
import Kit

/// Carrega e mantém o "Paladar" (`GET /api/recommendations`) exibido na Home.
@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var taste: TasteData?
    @Published private(set) var charts: ChartsData?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    /// `refresh: true` ignora o cache de 6h do backend (usado no pull-to-refresh).
    func load(refresh: Bool = false, api: FilmJournalAPI) async {
        if taste == nil { isLoading = true }
        defer { isLoading = false }
        errorMessage = nil
        do {
            async let tasteResult = api.recommendations.taste(refresh: refresh)
            // `/api/logs` limita a 200 registros (o máximo aceito pela API) — diários maiores que
            // isso não entram inteiros nos gráficos, diferente do web, que lê o banco sem limite.
            async let logsResult = api.logs.list(limit: 200)
            taste = try await tasteResult
            charts = ChartsAnalytics.compute(from: try await logsResult)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
