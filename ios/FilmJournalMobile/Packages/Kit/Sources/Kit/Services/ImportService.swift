import Foundation

/// Import do export do Letterboxd. É idempotente: reimportar não duplica nada.
public final class ImportService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// Limite de 4MB no `.zip`.
    public func importLetterboxd(zipData: Data, fileName: String = "letterboxd-export.zip") async throws -> LetterboxdImportResponse {
        try await client.upload("/import/letterboxd", fileFieldName: "archive", fileName: fileName, fileData: zipData, mimeType: "application/zip")
    }

    /// `fieldName` precisa ser um alias que o backend reconheça (`diary`, `ratings`, `films`...).
    public func importLetterboxdFiles(_ files: [(fieldName: String, fileName: String, data: Data)]) async throws -> LetterboxdImportResponse {
        try await client.upload(
            "/import/letterboxd",
            parts: files.map { (fieldName: $0.fieldName, fileName: $0.fileName, mimeType: "text/csv", data: $0.data) }
        )
    }
}
