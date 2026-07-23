import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Busca de filmes no TMDB (`GET /api/tmdb?q=`), com debounce simples via `.task(id:)`.
struct SearchView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = SearchViewModel()

    var body: some View {
        FJScreen("Buscar") {
        List {
            if let errorMessage = viewModel.errorMessage {
                ErrorStateView(message: errorMessage) {
                    Task { await viewModel.search(api: api) }
                }
                .listRowSeparator(.hidden)
            } else if viewModel.isLoading {
                LoadingStateView(message: "Buscando...")
                    .listRowSeparator(.hidden)
            } else if !viewModel.hasSearched {
                EmptyStateView(systemImage: "magnifyingglass", title: "Buscar filmes", message: "Digite para buscar.")
                    .listRowSeparator(.hidden)
            } else if viewModel.results.isEmpty {
                EmptyStateView(systemImage: "magnifyingglass", title: "Nenhum resultado", message: "Tente outro título.")
                    .listRowSeparator(.hidden)
            } else {
                ForEach(viewModel.results) { item in
                    Button {
                        root.exploreRouter.push(.filmDetail(.tmdb(item.id)))
                    } label: {
                        SearchResultRow(item: item)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .listStyle(.plain)
        }
        .searchable(text: $viewModel.query, prompt: "Título do filme")
        .task(id: viewModel.query) {
            try? await Task.sleep(for: .milliseconds(400))
            if Task.isCancelled { return }
            await viewModel.search(api: api)
        }
    }
}

private struct SearchResultRow: View {
    let item: TmdbMovieSearchResult

    var body: some View {
        HStack(spacing: Spacing.md) {
            RemotePosterImage(path: item.posterPath, size: .posterSmall)
                .frame(width: 56, height: 84)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(item.title)
                    .font(.headline)

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
        .padding(.vertical, Spacing.xs)
    }
}
