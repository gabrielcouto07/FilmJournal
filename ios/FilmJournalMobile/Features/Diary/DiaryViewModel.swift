import Foundation
import Kit

@MainActor
final class DiaryViewModel: ObservableObject {
    @Published private(set) var logs: [LogEntry] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    func load(api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            // A API já devolve as sessões mais recentes primeiro — mantemos a ordem tal como vem.
            logs = try await api.logs.list(limit: 50)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
