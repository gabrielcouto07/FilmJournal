import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Busca de filmes no TMDB (`GET /tmdb?q=`) e, quando a busca está vazia, os 5 feeds ao vivo
/// (trending/popular/nos cinemas/mais bem avaliados/em breve) com ações rápidas inline —
/// espelha `web/src/components/MovieSearch.tsx`.
struct SearchView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = SearchViewModel()

    var body: some View {
        FJScreen("Buscar") {
        VStack(spacing: 0) {
            if viewModel.mode == .feed {
                feedTabs
            }
            List {
                if let errorMessage = viewModel.errorMessage {
                    ErrorStateView(message: errorMessage) {
                        Task { await viewModel.load(api: api) }
                    }
                    .listRowSeparator(.hidden)
                } else if viewModel.isLoading && viewModel.results.isEmpty {
                    LoadingStateView(message: "Carregando...")
                        .listRowSeparator(.hidden)
                } else if viewModel.mode == .search && !viewModel.hasSearched {
                    EmptyStateView(systemImage: "magnifyingglass", title: "Buscar filmes", message: "Digite para buscar.")
                        .listRowSeparator(.hidden)
                } else if viewModel.results.isEmpty {
                    EmptyStateView(systemImage: "magnifyingglass", title: "Nenhum resultado", message: "Tente outro título ou feed.")
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(viewModel.results) { item in
                        SearchResultRow(
                            item: item,
                            isMutating: viewModel.mutatingId == item.id
                        ) {
                            Task {
                                if let movieId = await viewModel.ensureMovie(item, api: api) {
                                    root.exploreRouter.push(.filmDetail(.movieId(movieId)))
                                }
                            }
                        } onToggleWatchlist: {
                            Task { await viewModel.toggleWatchlist(item, api: api) }
                        } onToggleFavorite: {
                            Task { await viewModel.toggleFavorite(item, api: api) }
                        } onLog: {
                            Task {
                                if let movieId = await viewModel.ensureMovie(item, api: api) {
                                    root.exploreRouter.push(.filmDetail(.movieId(movieId)))
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
        }
        }
        .searchable(text: $viewModel.query, prompt: "Título do filme")
        .task(id: viewModel.query) {
            if !viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                try? await Task.sleep(for: .milliseconds(400))
                if Task.isCancelled { return }
            }
            await viewModel.load(api: api)
        }
        .task(id: viewModel.selectedFeed) {
            if viewModel.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                await viewModel.load(api: api)
            }
        }
    }

    private var feedTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                ForEach(TmdbFeed.allCases) { feed in
                    Button {
                        viewModel.selectedFeed = feed
                    } label: {
                        Text(feed.label)
                            .font(.footnote.bold())
                            .padding(.horizontal, Spacing.md)
                            .padding(.vertical, Spacing.xs)
                            .background(
                                feed == viewModel.selectedFeed ? Color.accentColor : Color.secondary.opacity(0.15),
                                in: Capsule()
                            )
                            .foregroundStyle(feed == viewModel.selectedFeed ? Color.white : Color.primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Spacing.md)
        }
        .padding(.vertical, Spacing.xs)
    }
}

private struct SearchResultRow: View {
    let item: TmdbMovieSearchResult
    let isMutating: Bool
    let onOpen: () -> Void
    let onToggleWatchlist: () -> Void
    let onToggleFavorite: () -> Void
    let onLog: () -> Void

    var body: some View {
        HStack(spacing: Spacing.md) {
            Button(action: onOpen) {
                HStack(spacing: Spacing.md) {
                    RemotePosterImage(path: item.posterPath, size: .posterSmall)
                        .frame(width: 56, height: 84)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))

                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(item.title)
                            .font(.headline)
                            .foregroundStyle(.primary)

                        HStack(spacing: Spacing.sm) {
                            if let year = item.year {
                                Text(String(year))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            HStack(spacing: 2) {
                                Image(systemName: "star.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.yellow)
                                Text("\(item.voteAverage ?? 0, specifier: "%.1f")")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        if item.existing != nil {
                            Text("Na coleção")
                                .font(.caption2.bold())
                                .padding(.horizontal, Spacing.sm)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.15), in: Capsule())
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer(minLength: Spacing.sm)

            if isMutating {
                ProgressView()
            } else {
                VStack(spacing: Spacing.sm) {
                    Button(action: onToggleWatchlist) {
                        Image(systemName: (item.existing?.watchlist ?? false) ? "bookmark.fill" : "bookmark")
                    }
                    Button(action: onToggleFavorite) {
                        Image(systemName: (item.existing?.favorite ?? false) ? "heart.fill" : "heart")
                    }
                    Button(action: onLog) {
                        Image(systemName: "plus.circle")
                    }
                }
                .buttonStyle(.borderless)
                .foregroundStyle(Color.accentColor)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
