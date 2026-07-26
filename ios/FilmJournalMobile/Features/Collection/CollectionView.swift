import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Coleção — Favoritos / Top 10 / Watchlist. `CollectionTab` já existe em `CoordinatorKit`
/// (usado também pelas rotas), então reaproveitamos em vez de duplicar um enum local.
struct CollectionView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = CollectionViewModel()
    @State private var selectedTab: CollectionTab = .favorites

    private let columns = [GridItem(.adaptive(minimum: 100, maximum: 140), spacing: Spacing.sm)]

    var body: some View {
        FJScreen("Coleção") {
            VStack(spacing: 0) {
                Picker("", selection: $selectedTab) {
                    ForEach(CollectionTab.allCases) { tab in
                        Text(title(for: tab)).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)

                content
            }
        }
        .task(id: selectedTab) {
            await viewModel.load(tab: selectedTab, api: api)
        }
    }

    @ViewBuilder
    private var content: some View {
        if selectedTab == .lists {
            ListsHubView()
        } else if viewModel.isLoading && viewModel.movies.isEmpty {
            LoadingStateView(message: "Carregando…")
        } else if let errorMessage = viewModel.errorMessage, viewModel.movies.isEmpty {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(tab: selectedTab, api: api) }
            }
        } else if viewModel.movies.isEmpty {
            ScrollView {
                EmptyStateView(
                    systemImage: emptyIcon(for: selectedTab),
                    title: "Nada aqui ainda",
                    message: emptyMessage(for: selectedTab)
                )
                .frame(minHeight: 400)
            }
            .refreshable {
                await viewModel.load(tab: selectedTab, api: api)
            }
        } else if selectedTab == .top10 {
            List {
                ForEach(viewModel.movies) { movie in
                    Top10Row(
                        movie: movie,
                        isMutating: viewModel.mutatingMovieId == movie.id,
                        canMoveUp: (movie.favoriteRank ?? 1) > 1,
                        canMoveDown: (movie.favoriteRank ?? viewModel.movies.count) < viewModel.movies.count
                    ) {
                        root.collectionRouter.push(.filmDetail(.local(movie)))
                    } onMoveUp: {
                        Task { await viewModel.moveRank(movie, direction: -1, api: api) }
                    } onMoveDown: {
                        Task { await viewModel.moveRank(movie, direction: 1, api: api) }
                    } onRemove: {
                        Task { await viewModel.remove(movie, from: selectedTab, api: api) }
                    }
                }
            }
            .listStyle(.plain)
            .refreshable {
                await viewModel.load(tab: selectedTab, api: api)
            }
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: Spacing.md) {
                    ForEach(viewModel.movies) { movie in
                        MovieCell(
                            movie: movie,
                            isRemoving: viewModel.mutatingMovieId == movie.id
                        ) {
                            root.collectionRouter.push(.filmDetail(.local(movie)))
                        } onRemove: {
                            Task { await viewModel.remove(movie, from: selectedTab, api: api) }
                        }
                    }
                }
                .padding(Spacing.md)
            }
            .refreshable {
                await viewModel.load(tab: selectedTab, api: api)
            }
        }
    }

    private func title(for tab: CollectionTab) -> String {
        switch tab {
        case .favorites: return "Favoritos"
        case .top10: return "Top 10"
        case .watchlist: return "Assistir depois"
        case .lists: return "Listas"
        }
    }

    private func emptyIcon(for tab: CollectionTab) -> String {
        switch tab {
        case .favorites: return "heart"
        case .top10: return "star"
        case .watchlist: return "bookmark"
        case .lists: return "rectangle.stack"
        }
    }

    private func emptyMessage(for tab: CollectionTab) -> String {
        switch tab {
        case .favorites: return "Marque filmes como favoritos na ficha do filme para vê-los aqui."
        case .top10: return "Escolha até 10 filmes favoritos na ficha do filme para montar seu Top 10."
        case .watchlist: return "Adicione filmes à sua watchlist na ficha do filme para vê-los aqui."
        case .lists: return "Crie listas para organizar seus filmes do seu jeito."
        }
    }
}

private struct MovieCell: View {
    let movie: Movie
    let isRemoving: Bool
    let onTap: () -> Void
    let onRemove: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                RemotePosterImage(path: movie.effectivePosterPath, size: .posterSmall)
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

                Text(movie.title)
                    .font(.caption)
                    .lineLimit(2)
                    .foregroundStyle(.primary)
            }
        }
        .buttonStyle(.plain)
        .disabled(isRemoving)
    }
}

/// Linha do Top 10 com promote/demote (`favoriteRank`) — espelha as setas do `FavoritesManager`
/// do web, que trocam de posição com quem ocupa o rank vizinho.
private struct Top10Row: View {
    let movie: Movie
    let isMutating: Bool
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onTap: () -> Void
    let onMoveUp: () -> Void
    let onMoveDown: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Spacing.md) {
            Text("\(movie.favoriteRank ?? 0)")
                .font(.title3.bold())
                .foregroundStyle(.secondary)
                .frame(width: 28)

            Button(action: onTap) {
                HStack(spacing: Spacing.md) {
                    RemotePosterImage(path: movie.effectivePosterPath, size: .posterSmall)
                        .frame(width: 44, height: 66)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
                    Text(movie.title)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                }
            }
            .buttonStyle(.plain)

            Spacer()

            if isMutating {
                ProgressView()
            } else {
                VStack(spacing: Spacing.xs) {
                    Button(action: onMoveUp) {
                        Image(systemName: "chevron.up")
                    }
                    .disabled(!canMoveUp)
                    Button(action: onMoveDown) {
                        Image(systemName: "chevron.down")
                    }
                    .disabled(!canMoveDown)
                }
                .buttonStyle(.borderless)

                Button(action: onRemove) {
                    Image(systemName: "xmark.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
