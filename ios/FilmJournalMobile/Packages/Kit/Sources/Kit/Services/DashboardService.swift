import Foundation

/// `/diary`, `/stats`, `/palate`, `/timeline`, `/motifs` — agregados computados no servidor.
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

    /// Já vem com o `verdict`, sem precisar de um request extra.
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
