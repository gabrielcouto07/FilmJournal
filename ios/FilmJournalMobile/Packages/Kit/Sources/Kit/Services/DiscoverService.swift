import Foundation

/// `/discover*` — pontos cegos do acervo (década, país, idioma, gênero).
public final class DiscoverService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func picks(dimension: GapDimension? = nil) async throws -> DiscoverData {
        try await client.request(.get, "/discover", query: ["dimension": dimension?.rawValue])
    }

    public func dismiss(dimension: GapDimension, gapKey: String) async throws {
        try await client.requestDiscardingResponse(.post, "/discover/dismiss", body: DismissBlindSpotRequest(dimension: dimension, gapKey: gapKey))
    }
}
