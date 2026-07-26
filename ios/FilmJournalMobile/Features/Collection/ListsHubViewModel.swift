import Foundation
import Kit

@MainActor
final class ListsHubViewModel: ObservableObject {
    @Published private(set) var lists: [MovieList] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?
    @Published private(set) var isCreating = false

    func load(api: FilmJournalAPI) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            lists = try await api.lists.all()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Retorna `true` em sucesso (a view fecha a sheet de criação nesse caso).
    func createList(name: String, description: String?, api: FilmJournalAPI) async -> Bool {
        isCreating = true
        defer { isCreating = false }
        do {
            let list = try await api.lists.create(CreateListRequest(name: name, description: description))
            lists.insert(list, at: 0)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func deleteList(_ list: MovieList, api: FilmJournalAPI) async {
        do {
            try await api.lists.delete(id: list.id)
            lists.removeAll { $0.id == list.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
