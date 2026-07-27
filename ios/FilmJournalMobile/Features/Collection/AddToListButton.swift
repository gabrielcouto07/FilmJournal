import SwiftUI
import Kit
import DesignKit

/// Só adiciona o filme a uma lista; remover é na tela da lista.
struct AddToListButton: View {
    let movieId: String

    @Environment(\.filmJournalAPI) private var api
    @State private var isShowingSheet = false

    var body: some View {
        Button {
            isShowingSheet = true
        } label: {
            Label("Adicionar à lista", systemImage: "text.badge.plus")
        }
        .sheet(isPresented: $isShowingSheet) {
            AddToListSheet(movieId: movieId)
        }
    }
}

private struct AddToListSheet: View {
    let movieId: String

    @Environment(\.filmJournalAPI) private var api
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = AddToListSheetViewModel()

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Adicionar à lista")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Fechar") { dismiss() }
                    }
                }
        }
        .task { await viewModel.load(movieId: movieId, api: api) }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.lists.isEmpty {
            LoadingStateView(message: "Carregando listas…")
        } else if viewModel.lists.isEmpty {
            EmptyStateView(
                systemImage: "rectangle.stack",
                title: "Nenhuma lista ainda",
                message: "Crie uma lista na aba Coleção para poder adicionar filmes."
            )
        } else {
            List(viewModel.lists) { list in
                Button {
                    Task { await viewModel.add(list: list, movieId: movieId, api: api) }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(list.name)
                            if let message = viewModel.feedback[list.id] {
                                Text(message).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if viewModel.containsMovie[list.id] == true {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                        } else if viewModel.addingListId == list.id {
                            ProgressView()
                        }
                    }
                }
                .disabled(viewModel.containsMovie[list.id] == true || viewModel.addingListId != nil)
            }
        }
    }
}

@MainActor
private final class AddToListSheetViewModel: ObservableObject {
    @Published private(set) var lists: [MovieList] = []
    @Published private(set) var isLoading = false
    @Published private(set) var addingListId: String?
    @Published private(set) var containsMovie: [String: Bool] = [:]
    @Published private(set) var feedback: [String: String] = [:]

    func load(movieId: String, api: FilmJournalAPI) async {
        isLoading = true
        defer { isLoading = false }
        if let loaded = try? await api.lists.all(movieId: movieId) {
            lists = loaded
            containsMovie = Dictionary(uniqueKeysWithValues: loaded.map { ($0.id, $0.containsMovie ?? false) })
        }
    }

    func add(list: MovieList, movieId: String, api: FilmJournalAPI) async {
        guard containsMovie[list.id] != true else { return }
        addingListId = list.id
        defer { addingListId = nil }
        do {
            let alreadyAdded = try await api.lists.addMovie(listId: list.id, movieId: movieId)
            containsMovie[list.id] = true
            feedback[list.id] = alreadyAdded ? "Já estava na lista" : "Adicionado"
        } catch {
            feedback[list.id] = error.localizedDescription
        }
    }
}
