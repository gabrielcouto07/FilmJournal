import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Aba "Listas" da Coleção — coleções nomeadas e livres (`/lists`), distintas de
/// Favoritos/Top10/Watchlist. Espelha `web/src/app/collection/lists/page.tsx`.
struct ListsHubView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = ListsHubViewModel()
    @State private var isShowingCreateSheet = false

    var body: some View {
        content
            .task { await viewModel.load(api: api) }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isShowingCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $isShowingCreateSheet) {
                CreateListSheet(isCreating: viewModel.isCreating) { name, description in
                    Task {
                        if await viewModel.createList(name: name, description: description, api: api) {
                            isShowingCreateSheet = false
                        }
                    }
                }
            }
            .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
                Button("OK") { viewModel.errorMessage = nil }
            }, message: {
                Text(viewModel.errorMessage ?? "")
            })
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.lists.isEmpty {
            LoadingStateView(message: "Carregando listas…")
        } else if let errorMessage = viewModel.errorMessage, viewModel.lists.isEmpty {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(api: api) }
            }
        } else if viewModel.lists.isEmpty {
            ScrollView {
                EmptyStateView(
                    systemImage: "rectangle.stack",
                    title: "Nenhuma lista ainda",
                    message: "Crie listas para organizar seus filmes do seu jeito."
                )
                .frame(minHeight: 400)
            }
            .refreshable { await viewModel.load(api: api) }
        } else {
            ScrollView {
                LazyVStack(spacing: Spacing.sm) {
                    ForEach(viewModel.lists) { list in
                        Button {
                            root.collectionRouter.push(.listDetail(id: list.id, name: list.name))
                        } label: {
                            ListCard(list: list)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
                                Task { await viewModel.deleteList(list, api: api) }
                            } label: {
                                Label("Excluir lista", systemImage: "trash")
                            }
                        }
                    }
                }
                .padding(Spacing.md)
            }
            .refreshable { await viewModel.load(api: api) }
        }
    }
}

private struct ListCard: View {
    let list: MovieList

    var body: some View {
        HStack(spacing: Spacing.md) {
            posterStack
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(list.name)
                    .font(.headline)
                    .foregroundStyle(.primary)
                if let description = list.description, !description.isEmpty {
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Text("\(list.movieCount) filme\(list.movieCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
        .padding(Spacing.sm)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: CornerRadius.medium))
    }

    private var posterStack: some View {
        let previews = Array(list.previewMovies.prefix(4))
        return ZStack(alignment: .leading) {
            ForEach(Array(previews.enumerated()), id: \.element.id) { index, item in
                RemotePosterImage(path: item.movie.effectivePosterPath, size: .posterSmall)
                    .frame(width: 44, height: 66)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
                    .offset(x: CGFloat(index) * 14)
            }
        }
        .frame(width: 44 + CGFloat(max(0, previews.count - 1)) * 14, height: 66, alignment: .leading)
    }
}

private struct CreateListSheet: View {
    let isCreating: Bool
    let onCreate: (String, String?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""

    private var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nome da lista", text: $name)
                TextField("Descrição (opcional)", text: $description, axis: .vertical)
                    .lineLimit(2...5)
            }
            .disabled(isCreating)
            .navigationTitle("Nova lista")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Criar") {
                        onCreate(trimmedName, description.isEmpty ? nil : description)
                    }
                    .disabled(trimmedName.isEmpty || isCreating)
                }
            }
        }
    }
}
