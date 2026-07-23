import Foundation

/// `/api/logs` — o diário (sessões de exibição).
public final class LogsService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    public func list(limit: Int = 50) async throws -> [LogEntry] {
        let response: LogsListResponse = try await client.request(.get, "/api/logs", query: ["limit": String(limit)])
        return response.logs
    }

    public func create(_ request: CreateLogRequest) async throws -> LogCreateResponse {
        try await client.request(.post, "/api/logs", body: request)
    }

    public func update(_ request: UpdateLogRequest) async throws -> LogEntry {
        let response: LogUpdateResponse = try await client.request(.patch, "/api/logs", body: request)
        return response.log
    }

    public func delete(id: String) async throws {
        try await client.requestDiscardingResponse(.delete, "/api/logs", query: ["id": id])
    }
}
