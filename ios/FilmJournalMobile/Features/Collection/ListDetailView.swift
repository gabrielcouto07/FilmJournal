import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

struct ListDetailView: View {
    let listId: String
    let listName: String

    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = ListDetailViewModel()

    private let columns = [GridItem(.adaptive(minimum: 100, maximum: 140), spacing: Spacing.sm)]

    var body: some View {
        FJScreen(viewModel.list?.name ?? listName, displayMode: .inline) {
            content
        }
        .task { await viewModel.load(id: listId, api: api) }
        .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
            Button("OK") { viewModel.errorMessage = nil }
        }, message: {
            Text(viewModel.errorMessage ?? "")
        })
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.list == nil {
            LoadingStateView(message: "Carregando lista…")
        } else if let list = viewModel.list {
            if list.movies.isEmpty {
                ScrollView {
                    EmptyStateView(
                        systemImage: "rectangle.stack",
                        title: "Lista vazia",
                        message: "Adicione filmes a partir da ficha de qualquer filme."
                    )
                    .frame(minHeight: 400)
                }
                .refreshable { await viewModel.load(id: listId, api: api) }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        if let description = list.description, !description.isEmpty {
                            Text(description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, Spacing.md)
                                .padding(.top, Spacing.sm)
                        }
                        LazyVGrid(columns: columns, spacing: Spacing.md) {
                            ForEach(list.movies) { item in
                                ListMovieCell(
                                    item: item,
                                    isRemoving: viewModel.removingMovieId == item.movieId
                                ) {
                                    root.collectionRouter.push(.filmDetail(.local(item.movie)))
                                } onRemove: {
                                    Task { await viewModel.removeMovie(item, api: api) }
                                }
                            }
                        }
                        .padding(Spacing.md)
                    }
                }
                .refreshable { await viewModel.load(id: listId, api: api) }
            }
        } else if let errorMessage = viewModel.errorMessage {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(id: listId, api: api) }
            }
        }
    }
}

private struct ListMovieCell: View {
    let item: MovieListDetailItem
    let isRemoving: Bool
    let onTap: () -> Void
    let onRemove: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                RemotePosterImage(path: item.movie.effectivePosterPath, size: .posterSmall)
                    .aspectRatio(2 / 3, contentMode: .fill)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
                    .overlay(alignment: .topTrailing) {
                        Button(action: onRemove) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.white, .black.opacity(0.6))
                                .font(.title3)
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                    }
                    .overlay {
                        if isRemoving {
                            ProgressView()
                                .padding(6)
                                .background(.black.opacity(0.4), in: RoundedRectangle(cornerRadius: CornerRadius.small))
                        }
                    }

                Text(item.movie.title)
                    .font(.caption)
                    .lineLimit(2)
                    .foregroundStyle(.primary)
            }
        }
        .buttonStyle(.plain)
        .disabled(isRemoving)
    }
}
