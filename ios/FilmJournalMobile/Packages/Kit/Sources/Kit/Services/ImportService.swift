import Foundation

/// `POST /import/letterboxd` — upload do export (.zip) do Letterboxd. Idempotente: reimportar
/// não duplica (o backend deduplica por `sourceKey`/`dedupeKey`).
public final class ImportService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// `zipData` é o conteúdo bruto do arquivo `.zip` exportado pelo Letterboxd (máx. 4MB).
    public func importLetterboxd(zipData: Data, fileName: String = "letterboxd-export.zip") async throws -> LetterboxdImportResponse {
        try await client.upload("/import/letterboxd", fileFieldName: "archive", fileName: fileName, fileData: zipData, mimeType: "application/zip")
    }

    /// Variante para CSVs soltos (sem `.zip`) — cada arquivo vai num campo próprio, nomeado com o
    /// alias que o backend já reconhece (ex. `diary`, `ratings`, `films`; ver `csvFieldAliases`
    /// em `api/src/modules/logs/routes.ts`).
    public func importLetterboxdFiles(_ files: [(fieldName: String, fileName: String, data: Data)]) async throws -> LetterboxdImportResponse {
        try await client.upload(
            "/import/letterboxd",
            parts: files.map { (fieldName: $0.fieldName, fileName: $0.fileName, mimeType: "text/csv", data: $0.data) }
        )
    }
}
