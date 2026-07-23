import Foundation

/// `POST /api/import/letterboxd` — upload do export (.zip) do Letterboxd. Idempotente: reimportar
/// não duplica (o backend deduplica por `sourceKey`/`dedupeKey`).
public final class ImportService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// `zipData` é o conteúdo bruto do arquivo `.zip` exportado pelo Letterboxd (máx. 4MB).
    public func importLetterboxd(zipData: Data, fileName: String = "letterboxd-export.zip") async throws -> LetterboxdImportResponse {
        try await client.upload("/api/import/letterboxd", fileFieldName: "archive", fileName: fileName, fileData: zipData, mimeType: "application/zip")
    }
}
