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
        if viewModel.isLoading && viewModel.movies.isEmpty {
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
        }
    }

    private func emptyIcon(for tab: CollectionTab) -> String {
        switch tab {
        case .favorites: return "heart"
        case .top10: return "star"
        case .watchlist: return "bookmark"
        }
    }

    private func emptyMessage(for tab: CollectionTab) -> String {
        switch tab {
        case .favorites: return "Marque filmes como favoritos na ficha do filme para vê-los aqui."
        case .top10: return "Escolha até 10 filmes favoritos na ficha do filme para montar seu Top 10."
        case .watchlist: return "Adicione filmes à sua watchlist na ficha do filme para vê-los aqui."
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
