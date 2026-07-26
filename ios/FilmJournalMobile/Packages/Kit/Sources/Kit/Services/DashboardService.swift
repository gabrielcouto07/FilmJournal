import Foundation

/// `/diary`, `/stats`, `/palate`, `/timeline`, `/motifs` — dados agregados computados no
/// servidor (o mesmo que alimenta `TasteDashboard`/`DiaryExplorer` no web).
public final class DashboardService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func diary() async throws -> DiaryData {
        try await client.request(.get, "/diary")
    }

    public func stats() async throws -> StatsData {
        try await client.request(.get, "/stats")
    }

    /// Já inclui o `verdict` (headline/sentence do "perfil de gosto") — computado no mesmo
    /// request, ver `dashboardRoutes` no backend.
    public func palate() async throws -> PalateData {
        try await client.request(.get, "/palate")
    }

    public func timeline() async throws -> TimelineData {
        try await client.request(.get, "/timeline")
    }

    public func motifs() async throws -> MotifSummary {
        try await client.request(.get, "/motifs")
    }
}
