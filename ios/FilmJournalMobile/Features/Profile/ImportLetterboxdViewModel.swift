import Foundation
import Kit

@MainActor
final class ImportLetterboxdViewModel: ObservableObject {
    @Published private(set) var isImporting = false
    @Published var errorMessage: String?
    @Published private(set) var result: LetterboxdImportResponse?

    func importFile(from url: URL, api: FilmJournalAPI) async {
        errorMessage = nil
        result = nil
        isImporting = true
        defer { isImporting = false }

        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        do {
            let data = try Data(contentsOf: url)
            result = try await api.importer.importLetterboxd(zipData: data, fileName: url.lastPathComponent)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
