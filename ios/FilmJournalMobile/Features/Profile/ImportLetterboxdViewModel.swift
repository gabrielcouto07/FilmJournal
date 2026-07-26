import Foundation
import Kit

@MainActor
final class ImportLetterboxdViewModel: ObservableObject {
    @Published private(set) var isImporting = false
    @Published var errorMessage: String?
    @Published private(set) var result: LetterboxdImportResponse?

    /// Nome do arquivo (minúsculo) -> campo aceito pelo backend, igual a `csvFieldAliases`
    /// (bare name, sem extensão; `likes/films.csv` vira `films`).
    private static let knownFileNames: [String: String] = [
        "diary.csv": "diary",
        "reviews.csv": "reviews",
        "ratings.csv": "ratings",
        "watched.csv": "watched",
        "watchlist.csv": "watchlist",
        "profile.csv": "profile",
        "films.csv": "films",
    ]

    /// Um único `.zip` continua indo pelo caminho de arquivo único (comportamento pré-existente).
    /// Qualquer outra seleção é tratada como CSVs soltos, um campo multipart por arquivo.
    func importFiles(_ urls: [URL], api: FilmJournalAPI) async {
        errorMessage = nil
        result = nil
        guard !urls.isEmpty else { return }
        isImporting = true
        defer { isImporting = false }

        if urls.count == 1, urls[0].pathExtension.lowercased() == "zip" {
            await importZip(urls[0], api: api)
            return
        }

        var parts: [(fieldName: String, fileName: String, data: Data)] = []
        var unrecognized: [String] = []

        for url in urls {
            guard url.pathExtension.lowercased() == "csv" else { continue }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }

            let fileName = url.lastPathComponent
            guard let fieldName = Self.knownFileNames[fileName.lowercased()] else {
                unrecognized.append(fileName)
                continue
            }
            do {
                let data = try Data(contentsOf: url)
                parts.append((fieldName: fieldName, fileName: fileName, data: data))
            } catch {
                errorMessage = error.localizedDescription
            }
        }

        guard !parts.isEmpty else {
            errorMessage = unrecognized.isEmpty
                ? "Nenhum CSV selecionado."
                : "Nenhum arquivo reconhecido. Esperado: diary.csv, reviews.csv, ratings.csv, watched.csv, watchlist.csv, profile.csv ou films.csv."
            return
        }

        do {
            result = try await api.importer.importLetterboxdFiles(parts)
            if !unrecognized.isEmpty {
                errorMessage = "Ignorado(s) por não serem reconhecidos: \(unrecognized.joined(separator: ", "))."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func importZip(_ url: URL, api: FilmJournalAPI) async {
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
